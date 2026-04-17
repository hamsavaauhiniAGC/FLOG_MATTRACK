sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "ns/flgmat/formatter",

    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Token",
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageToast",
    "sap/ui/comp/smartvariants/PersonalizableInfo"

], (Controller,
    formatter,

    JSONModel,
    Filter,
    FilterOperator,
    Token,
    Spreadsheet,
    MessageToast,
    PersonalizableInfo
) => {
    "use strict";

    return Controller.extend("ns.flgmat.controller.Main", {
        formatter: formatter,

        onInit: function () {
            var oLocalModel = new sap.ui.model.json.JSONModel([]);
            this.getView().setModel(oLocalModel, "trackModel");
            // this._loadTrackdata([])
            //     .then(function (aData) {
            //         console.log("Initial load success:", aData.length);
            //     })
            //     .catch(function () {
            //         sap.m.MessageToast.show("Initial load failed");
            //     });

            // References
            this.oFilterBar = this.byId("idFilterBar");
            this.oSmartVariantManagement = this.byId("svm");
            this.oTable = this.byId("idTabTrackList");

            // Attach FilterBar personalizable info
            var oFilterPersInfo = new PersonalizableInfo({
                type: "filterBar",
                keyName: "persistencyKey",
                control: this.oFilterBar
            });
            this.oSmartVariantManagement.addPersonalizableControl(oFilterPersInfo);

            // Attach Table personalizable info
            var oTablePersInfo = new PersonalizableInfo({
                type: "table",
                keyName: "persistencyKey",
                control: this.oTable
            });

            this.oSmartVariantManagement.addPersonalizableControl(oTablePersInfo);


            this.oSmartVariantManagement.initialise(function () {
                console.log("Variant initialized");
            }, this.oFilterBar);
            // Register filter hooks
            this.oFilterBar.registerFetchData(this._fetchData.bind(this));
            this.oFilterBar.registerApplyData(this._applyData.bind(this));

        },

        // Get current values from all MultiInput fields as array of keys
        _fetchData: function () {

            var aFilterData = this.oFilterBar.getFilterGroupItems().map(function (oItem) {

                var oControl = oItem.getControl();
                var aTokens = oControl.getTokens ? oControl.getTokens() : [];

                var aKeys = aTokens.map(function (t) {
                    return t.getKey();
                });

                return {
                    groupName: oItem.getGroupName(),
                    fieldName: oItem.getName(),
                    fieldData: aKeys
                };
            });

            // Table column data
            var aColumnData = this.oTable.getColumns().map(function (oColumn, index) {
                return {
                    id: oColumn.getId(),
                    visible: oColumn.getVisible(),
                    order: index
                };
            });
            // Sorting
            var oBinding = this.oTable.getBinding("rows");
            var aSorters = [];

            if (oBinding && oBinding.aSorters) {
                aSorters = oBinding.aSorters.map(function (oSorter) {
                    return {
                        path: oSorter.sPath,
                        descending: oSorter.bDescending
                    };
                });
            }

            return {
                filters: aFilterData,
                columns: aColumnData,
                sorters: aSorters
            };
        },
        // Apply saved variant to MultiInput controls
        _applyData: function (oVariantData) {
            if (!oVariantData) {
                return;
            }
            var aData = oVariantData.filters || [];
            aData.forEach(function (oDataObject) {
                var oItem = this.oFilterBar.getFilterGroupItems().find(function (item) {
                    return item.getName() === oDataObject.fieldName &&
                        item.getGroupName() === oDataObject.groupName;
                });
                if (oItem) {
                    var oControl = oItem.getControl();
                    if (oControl.setTokens) {
                        // Remove existing tokens
                        oControl.removeAllTokens();
                        // Add tokens from variant
                        oDataObject.fieldData.forEach(function (sKey) {
                            oControl.addToken(new Token({ key: sKey, text: sKey }));
                        });
                    }
                }
            }.bind(this));
            // Apply column visibility
            if (oVariantData.columns) {
                var oTable = this.oTable;
                var aSortedColumns = oVariantData.columns.sort(function (a, b) {
                    return a.order - b.order;
                });
                aSortedColumns.forEach(function (oColData, newIndex) {

                    var oColumn = sap.ui.getCore().byId(oColData.id);

                    if (oColumn) {
                        oColumn.setVisible(oColData.visible);
                        // Move column to correct position
                        oTable.removeColumn(oColumn);
                        oTable.insertColumn(oColumn, newIndex);
                    }

                });

            }
            // Apply Sorting
            if (oVariantData.sorters) {
                var oBinding = this.oTable.getBinding("rows");

                if (oBinding) {
                    var aSorters = oVariantData.sorters.map(function (oSorter) {
                        return new sap.ui.model.Sorter(
                            oSorter.path,
                            oSorter.descending // false = ASC, true = DESC
                        );
                    });

                    oBinding.sort(aSorters);
                }
            }
        },
        onSelectionChange: function (oEvent) {
            // Mark variant as modified whenever user changes filter
            this.oSmartVariantManagement.currentVariantSetModified(true);
            this.oFilterBar.fireFilterChange(oEvent);
        },
        // Trigger search after a variant is applied
        onAfterVariantLoad: function () {

            setTimeout(function () {
                var bHasData = this.oFilterBar.getFilterGroupItems().some(function (oItem) {

                    var oControl = oItem.getControl();

                    if (oControl.getTokens) {
                        return oControl.getTokens().length > 0;
                    }

                    return false;
                });

                if (bHasData) {
                    this.onFltrSearch();
                }
                else {
                    // when in variant filter is blank then the table column value -blank
                    var oModel = this.getView().getModel("trackModel");
                    oModel.setData([]);
                }
            }.bind(this), 200);
        },

        onAfterRendering: function () {
            console.log("onAfterRendering");
            var oFilterBar = this.byId("idFilterBar");

            if (!oFilterBar) {
                return;
            }

            var aDefineConditionFields = [
                "idFltrPO",
                "idFltrSTO",
                "idFltrDelivery",
                "idFltrPurReq",
                "idFltrMOType",
                "idFltrStrtdt",
                "idFltrGpEndDt",
                "idFltrOpr",
                "idFltrResItemNo",
                "idFltrGpStorLoc", "idFltrGpRequestor", "idFltrSupplyPlant",
                "idFltrSupplyPlantSTO", "idFltrIssueSLoc", "idFltrSupplier",
                "idFltrDeliveryDate", "idFltrDeliveryCrtDate", "idFltrDeliveryPickingdate",
                "idFltrDeliverPickingstatus", "idFltrDelActGoodsIssuDate", "idFltrDeliPlndGoodsIssuDate",
                "idFltrdeliGoodsIssuDate", "idFltrDeliveryfinalstatus", "idFltrReturnSTO",
                "idFltrReturnDeliverySupplier"

            ];

            oFilterBar.getAllFilterItems().forEach(function (oItem) {

                var oControl = oItem.getControl();

                if (oControl instanceof sap.m.MultiInput) {

                    var sId = oControl.getId().split("--").pop();

                    if (aDefineConditionFields.includes(sId)) {

                        oControl.setShowValueHelp(true);

                        oControl.attachValueHelpRequest(
                            this.onDefineConditionVHRqst.bind(this)
                        );
                    }
                }

            }.bind(this));
        },
        onDefineConditionVHRqst: function (oEvent) {

            var oMultiInput = oEvent.getSource();
            var sLabel = oMultiInput.getParent().getLabel();
            var sFieldId = oMultiInput.getId();
            this._mFieldTokens = this._mFieldTokens || {};
            this._oCurrentInput = oMultiInput;

            // ALWAYS destroy old dialog 
            if (this._oRangeVH) {
                this._oRangeVH.destroy();
                this._oRangeVH = null;
            }

            if (!this._oRangeVH) {
                this._oRangeVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Define Conditions",
                    supportRanges: true,
                    supportRangesOnly: true,

                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        this._mFieldTokens[sFieldId] = aTokens;
                        var sCurrentFieldId = this._oCurrentInput.getId();

                        this._oCurrentInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {

                            var oRange = oToken.data("range");

                            if (oRange) {
                                var sKey = oRange.value1;

                                if (oRange.value2) {
                                    sKey = oRange.value1 + "..." + oRange.value2;
                                }
                                var oNewToken = new sap.m.Token({
                                    key: sKey,
                                    text: sKey
                                });

                                // store full range (operation, value1, value2, exclude)
                                oNewToken.data("range", oRange);

                                this._oCurrentInput.addToken(oNewToken);
                            }

                        }.bind(this));

                        this._oRangeVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oRangeVH.close();
                    }.bind(this)
                });

                this.getView().addDependent(this._oRangeVH);
            }

            this._oRangeVH.setTitle(sLabel);

            this._oRangeVH.setRangeKeyFields([
                {
                    label: sLabel,
                    key: sFieldId,   //  filter id instead of label
                    type: "string",
                    typeInstance: new sap.ui.model.type.String()
                }
            ]);

            var aSavedTokens = this._mFieldTokens[sFieldId] || [];

            this._oRangeVH.setTokens([]);
            this._oRangeVH.setTokens(aSavedTokens);

            this._oRangeVH.open();
        },

        _loadTrackdata: function (aFilters) {
            //_loadTrackdata: function () {    
            var oModel = this.getOwnerComponent().getModel();
            var oView = this.getView();
            oView.setBusy(true);
            var aSorters = [new sap.ui.model.Sorter("Reservation", false),
            sap.ui.model.Sorter("ReservationItem", false)];
            return new Promise((resolve, reject) => {
                oModel.read("/YY1_FLGTRK_Tracking_API", {
                    filters: aFilters, // Pass the filters here!
                    sorters: aSorters,
                    success: async function (oData) {
                        oView.setBusy(false);
                        var aResults = oData.results;
                        var oUniqueMap = new Map();
                        aResults.forEach(function (oItem) {

                            var sCompositeKey = oItem.MaintenanceOrder + "|" + oItem.MaintenanceOrderOperation + "|" + oItem.Reservation + "|" + oItem.ReservationItem
                                + "|" + oItem.STO + "|" + oItem.STOItem + "|" + oItem.PurchaseOrder + "|" + oItem.POItem;

                            var nOrderQty = parseFloat(oItem.OrderQuantity || 0);
                            var nDeliveredQty = parseFloat(oItem.QuantityinBaseUnit || 0); // Assuming 'Quantity' is your delivered field
                            nDeliveredQty = Math.abs(nDeliveredQty);
                            if (nDeliveredQty === 0) {
                                // Logic: if Quantity is 0, then yetDel becomes the orderQty
                                oItem.YetToDeliverQTY = nOrderQty;
                            } else {
                                // Optional: Handle cases where Quantity is NOT 0 if needed
                                oItem.YetToDeliverQTY = nOrderQty - nDeliveredQty;
                            }
                            if (!oUniqueMap.has(sCompositeKey)) {
                                oUniqueMap.set(sCompositeKey, oItem);
                            }
                        });
                        var aFinalData = Array.from(oUniqueMap.values());

                        // SKIP UCC IF UCC have no similar fields with Main Service

                        var bSkipUCC = false;

                        aFilters.forEach(function (oFilter) {

                            // Direct filter
                            if (oFilter.sPath === "Plant" || oFilter.sPath === "Material"
                                || oFilter.sPath === "RequirementDate" || oFilter.sPath === "PurchaseRequisition"
                                || oFilter.sPath === "PurchaseOrder" || oFilter.sPath === "STO" || oFilter.sPath === "Reservation"
                                || oFilter.sPath === "MaintenanceOrderType"
                            ) {
                                bSkipUCC = true;
                            }

                            // MultiFilter
                            if (oFilter.aFilters) {
                                oFilter.aFilters.forEach(function (subFilter) {
                                    if (subFilter.sPath === "Plant" || subFilter.sPath === "Material"
                                        || subFilter.sPath === "RequirementDate" || subFilter.sPath === "PurchaseRequisition"
                                        || subFilter.sPath === "PurchaseOrder" || subFilter.sPath === "STO" || subFilter.sPath === "Reservation"
                                        || subFilter.sPath === "MaintenanceOrderType"
                                    ) {
                                        bSkipUCC = true;
                                    }
                                });
                            }

                        });

                        //UCC PROCESSING 
                        var pUCCProcess = Promise.resolve();

                        if (!bSkipUCC) {


                            //UCC API -> to pass the Maintenance Order
                            // var aMaintOrders = [...new Set(
                            //     aFinalData.map(o => o.MaintenanceOrder)
                            // )];
                            var aMaintOrders = [];
                            // aFinalData has value fetch Maint Order from that
                            if (aFinalData && aFinalData.length > 0) {

                                aMaintOrders = [...new Set(
                                    aFinalData.map(function (o) {
                                        return o.MaintenanceOrder;
                                    })
                                )];

                            } else {
                                //Direct from Filterid
                                //MO Filter
                                var oMaintInput = this.getView().byId("idFltrMo");
                                var aMaintTokens = oMaintInput ? oMaintInput.getTokens() : [];
                                var aMaintFilterOrders = aMaintTokens.map(function (oToken) {
                                    return oToken.getKey();
                                });
                                aMaintOrders = aMaintFilterOrders;
                            }

                            // Delivery Filter
                            var oDeliveryInput = this.getView().byId("idFltrDelivery");

                            var aDeliveryTokens = oDeliveryInput
                                ? oDeliveryInput.getTokens()
                                : [];

                            console.log("Delivery Tokens:", aDeliveryTokens);

                            //UCC API
                            var oUCCMap = await this._getUCCDataMap(aMaintOrders, aDeliveryTokens);
                            var aUCCMergedData = [];
                            var oProcessedOrders = new Set();


                            //Main API + UCC - If Main API have value
                            if (aFinalData && aFinalData.length > 0) {

                                // Keep original data FIRST
                                aFinalData.forEach(function (oItem) {
                                    aUCCMergedData.push(oItem);
                                });

                                //  Add UCC rows separately
                                aFinalData.forEach(function (oItem) {

                                    var sOrder = oItem.MaintenanceOrder.padStart(12, '0');

                                    //  Avoid repeating same order again
                                    if (oProcessedOrders.has(sOrder)) {
                                        return;
                                    }
                                    oProcessedOrders.add(sOrder);

                                    var aUCCList = oUCCMap.get(sOrder);

                                    if (aUCCList && aUCCList.length > 0) {

                                        aUCCList.forEach(function (oMatchedUCC) {

                                            var oNEWUCC = {};

                                            //  Only required fields
                                            oNEWUCC.MaintenanceOrder = oItem.MaintenanceOrder;
                                            oNEWUCC.MaintenanceOrderDesc = oItem.MaintenanceOrderDesc;
                                            oNEWUCC.MaintenanceOrderType = oItem.MaintenanceOrderType;
                                            oNEWUCC.MaintOrdBasicStartDate = oItem.MaintOrdBasicStartDate;
                                            oNEWUCC.MaintOrdBasicEndDate = oItem.MaintOrdBasicEndDate;
                                            oNEWUCC.Reservation = "";
                                            oNEWUCC.Plant = "";
                                            oNEWUCC.Material = "";


                                            if (oMatchedUCC.IsReturn === true) {

                                                oNEWUCC.ReturnDeliveryNumber = oMatchedUCC.DelNum || "";
                                                oNEWUCC.ReturnDeliveryItem = oMatchedUCC.DelItem || "";
                                                oNEWUCC.DeliveryDocumentType_RDeli = oMatchedUCC.DeliveryDocumentType || "";
                                                oNEWUCC.PlannedGoodsIssueDate_RDeli = oMatchedUCC.PlannedGoodsIssueDate || "";
                                                oNEWUCC.OverallGoodsMovementSt_RDEL = oMatchedUCC.OverallGoodsMovementStatus || "";
                                                oNEWUCC.ActualGoodsMovementD_RDel = oMatchedUCC.ActualGoodsMovementDate || "";
                                                oNEWUCC.OvrlItmGeneralIncompletion_RDe = oMatchedUCC.OvrlItmGeneralIncompletionSts || "";
                                                oNEWUCC.InventoryValuationType_RDeli = oMatchedUCC.InventoryValuationType || "";
                                                oNEWUCC.PickingDate_RDeli = oMatchedUCC.PickingDate || "";

                                            } else {

                                                oNEWUCC.DeliveryNumber = oMatchedUCC.DelNum || "";
                                                oNEWUCC.DeliveryItem = oMatchedUCC.DelItem || "";
                                                oNEWUCC.DeliveryDocumentType_Deli = oMatchedUCC.DeliveryDocumentType || "";
                                                oNEWUCC.PlannedGoodsIssueDate_Deli = oMatchedUCC.PlannedGoodsIssueDate || "";
                                                oNEWUCC.OverallGoodsMovementStat_Deli = oMatchedUCC.OverallGoodsMovementStatus || "";
                                                oNEWUCC.ActualGoodsMovementDa_Deli = oMatchedUCC.ActualGoodsMovementDate || "";
                                                oNEWUCC.OvrlItmGeneralIncompletio_Deli = oMatchedUCC.OvrlItmGeneralIncompletionSts || "";
                                                oNEWUCC.InventoryValuationType_Del = oMatchedUCC.InventoryValuationType || "";
                                                oNEWUCC.PickingDate_Deli = oMatchedUCC.PickingDate || "";
                                            }
                                            //oNEWUCC.Plant = oMatchedUCC.Plant || "";
                                            oNEWUCC.BinLocation = oMatchedUCC.BinLocation || "";
                                            oNEWUCC.DropLocation = oMatchedUCC.DropLocation || "";
                                            oNEWUCC.OffShoreBin = oMatchedUCC.OffShoreBin || "";
                                            oNEWUCC.OldShipItem = oMatchedUCC.OldShipItem || "";
                                            oNEWUCC.RentalInfo = oMatchedUCC.RentalInfo || "";
                                            oNEWUCC.Supplier_WOREF = oMatchedUCC.Supplier || "";
                                            oNEWUCC.RefDelivery = oMatchedUCC.RetDel || "";
                                            oNEWUCC.Description = oMatchedUCC.DeliveryDocumentItemText || "";

                                            aUCCMergedData.push(oNEWUCC);

                                        });

                                    }

                                });

                                //aFinalData = aUCCMergedData;
                                pUCCProcess = Promise.resolve().then(function () {
                                    aFinalData = aUCCMergedData;
                                });
                            }

                            else {
                                var aPromises = [];
                                oUCCMap.forEach(function (aUCCList, sOrder) {
                                    aUCCList.forEach(function (oMatchedUCC) {
                                        var sMaintOrder = oMatchedUCC.MaintOrder;
                                        var pPromise = new Promise(function (resolve) {
                                            var sDesc = "";
                                            var sMOType = "";
                                            var sStrtDate = "";
                                            var sEndDate = ""
                                            oModel.read("/YY1_FLGTRK_Tracking_API", {
                                                filters: [
                                                    new sap.ui.model.Filter(
                                                        "MaintenanceOrder",
                                                        sap.ui.model.FilterOperator.EQ,
                                                        sMaintOrder
                                                    )
                                                ],

                                                success: function (oResponse) {

                                                    if (oResponse.results && oResponse.results.length > 0) {
                                                        sDesc = oResponse.results[0].MaintenanceOrderDesc || "";
                                                        sMOType = oResponse.results[0].MaintenanceOrderType || "";
                                                        sStrtDate = oResponse.results[0].MaintOrdBasicStartDate || "";
                                                        sEndDate = oResponse.results[0].MaintOrdBasicEndDate || "";

                                                    }

                                                    resolve({
                                                        oMatchedUCC: oMatchedUCC,
                                                        sDesc: sDesc,
                                                        sMOType: sMOType,
                                                        sStrtDate: sStrtDate,
                                                        sEndDate: sEndDate
                                                    });
                                                },

                                                error: function (oError) {

                                                    console.log(
                                                        "Unable to fetch data for UCC based on Tracking API",
                                                        oError
                                                    );

                                                    resolve({
                                                        oMatchedUCC: oMatchedUCC,
                                                        sDesc: "",
                                                        sMOType: ""
                                                    });
                                                }
                                            });

                                        });
                                        aPromises.push(pPromise);

                                    });

                                });

                                pUCCProcess = Promise.all(aPromises).then(function (aResults) {

                                    aResults.forEach(function (oResult) {

                                        var oMatchedUCC = oResult.oMatchedUCC;
                                        var sDesc = oResult.sDesc;
                                        var sMOType = oResult.sMOType;
                                        var sEndDate = oResult.sEndDate;
                                        var sStrtDate = oResult.sStrtDate;

                                        var oNEWUCC = {};

                                        oNEWUCC.MaintenanceOrder = oMatchedUCC.MaintOrder;
                                        oNEWUCC.MaintenanceOrderDesc = sDesc;
                                        oNEWUCC.MaintenanceOrderType = sMOType;
                                        oNEWUCC.MaintOrdBasicStartDate = sStrtDate;
                                        oNEWUCC.MaintOrdBasicEndDate = sEndDate;
                                        oNEWUCC.Reservation = "";
                                        oNEWUCC.Plant = "";
                                        oNEWUCC.Material = "";

                                        if (oMatchedUCC.IsReturn === true) {

                                            oNEWUCC.ReturnDeliveryNumber = oMatchedUCC.DelNum || "";
                                            oNEWUCC.ReturnDeliveryItem = oMatchedUCC.DelItem || "";
                                            oNEWUCC.DeliveryDocumentType_RDeli = oMatchedUCC.DeliveryDocumentType || "";
                                            oNEWUCC.PlannedGoodsIssueDate_RDeli = oMatchedUCC.PlannedGoodsIssueDate || "";
                                            oNEWUCC.OverallGoodsMovementSt_RDEL = oMatchedUCC.OverallGoodsMovementStatus || "";
                                            oNEWUCC.ActualGoodsMovementD_RDel = oMatchedUCC.ActualGoodsMovementDate || "";
                                            oNEWUCC.OvrlItmGeneralIncompletion_RDe = oMatchedUCC.OvrlItmGeneralIncompletionSts || "";
                                            oNEWUCC.InventoryValuationType_RDeli = oMatchedUCC.InventoryValuationType || "";
                                            oNEWUCC.PickingDate_RDeli = oMatchedUCC.PickingDate || "";

                                        } else {

                                            oNEWUCC.DeliveryNumber = oMatchedUCC.DelNum || "";
                                            oNEWUCC.DeliveryItem = oMatchedUCC.DelItem || "";
                                            oNEWUCC.DeliveryDocumentType_Deli = oMatchedUCC.DeliveryDocumentType || "";
                                            oNEWUCC.PlannedGoodsIssueDate_Deli = oMatchedUCC.PlannedGoodsIssueDate || "";
                                            oNEWUCC.OverallGoodsMovementStat_Deli = oMatchedUCC.OverallGoodsMovementStatus || "";
                                            oNEWUCC.ActualGoodsMovementDa_Deli = oMatchedUCC.ActualGoodsMovementDate || "";
                                            oNEWUCC.OvrlItmGeneralIncompletio_Deli = oMatchedUCC.OvrlItmGeneralIncompletionSts || "";
                                            oNEWUCC.InventoryValuationType_Del = oMatchedUCC.InventoryValuationType || "";
                                            oNEWUCC.PickingDate_Deli = oMatchedUCC.PickingDate || "";
                                        }

                                        //oNEWUCC.Plant = oMatchedUCC.Plant || "";
                                        oNEWUCC.BinLocation = oMatchedUCC.BinLocation || "";
                                        oNEWUCC.DropLocation = oMatchedUCC.DropLocation || "";
                                        oNEWUCC.OffShoreBin = oMatchedUCC.OffShoreBin || "";
                                        oNEWUCC.OldShipItem = oMatchedUCC.OldShipItem || "";
                                        oNEWUCC.RentalInfo = oMatchedUCC.RentalInfo || "";
                                        oNEWUCC.Supplier_WOREF = oMatchedUCC.Supplier || "";
                                        oNEWUCC.RefDelivery = oMatchedUCC.RetDel || "";
                                        oNEWUCC.Description = oMatchedUCC.DeliveryDocumentItemText || "";
                                        aUCCMergedData.push(oNEWUCC);

                                    });

                                    aFinalData = aUCCMergedData;

                                    console.log("Final UCC Data:", aFinalData);

                                });

                            }

                            //     oUCCMap.forEach(function (aUCCList, sOrder) {

                            //         aUCCList.forEach(function (oMatchedUCC) {
                            //             var sMaintOrder = [];
                            //             sMaintOrder = oMatchedUCC.MaintOrder;

                            //             var oNEWUCC = {};

                            //             oNEWUCC.MaintenanceOrder = oMatchedUCC.MaintOrder;
                            //             oNEWUCC.MaintenanceOrderDesc = "";
                            //             oNEWUCC.MaintenanceOrderType = "";
                            //             oNEWUCC.Reservation = "";
                            //             oNEWUCC.Plant = "";
                            //             oNEWUCC.Material = "";

                            //             if (oMatchedUCC.IsReturn === true) {

                            //                 oNEWUCC.ReturnDeliveryNumber = oMatchedUCC.DelNum || "";
                            //                 oNEWUCC.ReturnDeliveryItem = oMatchedUCC.DelItem || "";
                            //                 oNEWUCC.DeliveryDocumentType_RDeli = oMatchedUCC.DeliveryDocumentType || "";
                            //                 oNEWUCC.PlannedGoodsIssueDate_RDeli = oMatchedUCC.PlannedGoodsIssueDate || "";
                            //                 oNEWUCC.OverallGoodsMovementSt_RDEL = oMatchedUCC.OverallGoodsMovementStatus || "";
                            //                 oNEWUCC.ActualGoodsMovementD_RDel = oMatchedUCC.ActualGoodsMovementDate || "";
                            //                 oNEWUCC.OvrlItmGeneralIncompletion_RDe = oMatchedUCC.OvrlItmGeneralIncompletionSts || "";
                            //                 oNEWUCC.InventoryValuationType_RDeli = oMatchedUCC.InventoryValuationType || "";
                            //                 oNEWUCC.PickingDate_RDeli = oMatchedUCC.PickingDate || "";

                            //             } else {

                            //                 oNEWUCC.DeliveryNumber = oMatchedUCC.DelNum || "";
                            //                 oNEWUCC.DeliveryItem = oMatchedUCC.DelItem || "";
                            //                 oNEWUCC.DeliveryDocumentType_Deli = oMatchedUCC.DeliveryDocumentType || "";
                            //                 oNEWUCC.PlannedGoodsIssueDate_Deli = oMatchedUCC.PlannedGoodsIssueDate || "";
                            //                 oNEWUCC.OverallGoodsMovementStat_Deli = oMatchedUCC.OverallGoodsMovementStatus || "";
                            //                 oNEWUCC.ActualGoodsMovementDa_Deli = oMatchedUCC.ActualGoodsMovementDate || "";
                            //                 oNEWUCC.OvrlItmGeneralIncompletio_Deli = oMatchedUCC.OvrlItmGeneralIncompletionSts || "";
                            //                 oNEWUCC.InventoryValuationType_Del = oMatchedUCC.InventoryValuationType || "";
                            //                 oNEWUCC.PickingDate_Deli = oMatchedUCC.PickingDate || "";

                            //             }
                            //             oNEWUCC.Plant = oMatchedUCC.Plant || "";
                            //             oNEWUCC.BinLocation = oMatchedUCC.BinLocation || "";
                            //             oNEWUCC.DropLocation = oMatchedUCC.DropLocation || "";
                            //             oNEWUCC.OffShoreBin = oMatchedUCC.OffShoreBin || "";
                            //             oNEWUCC.OldShipItem = oMatchedUCC.OldShipItem || "";
                            //             oNEWUCC.RentalInfo = oMatchedUCC.RentalInfo || "";
                            //             oNEWUCC.Supplier_WOREF = oMatchedUCC.Supplier || "";
                            //             oNEWUCC.RefDelivery = oMatchedUCC.RetDel || "";

                            //             aUCCMergedData.push(oNEWUCC);

                            //         });

                            //     });

                            //     aFinalData = aUCCMergedData;
                            // }
                        }

                        //new - Container API
                        pUCCProcess.then(function () {
                            var aPromises = aFinalData.map(function (oItem) {
                                if (oItem.DeliveryNumber) { // Ensure you use the right property name
                                    return this._getContainerDetails(oItem);
                                }
                                return Promise.resolve();
                            }.bind(this));
                            Promise.all(aPromises).then(function () {
                                var oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                                aFinalData.forEach(function (oItem) {

                                    //Delivery final status
                                    oItem.DeliveryFinalStatus = "";
                                    var isNL = oItem.DeliveryDocumentType_Deli === "NL";
                                    var is101 = oItem.GoodsMovementType_STO === "101";
                                    var isContainerReceived = oItem.ContainerStatus === "Received";
                                    // STO Case
                                    if (isNL && is101) {
                                        oItem.DeliveryFinalStatus = "Received";
                                    }
                                    // Other Deliveries
                                    else if (!isNL && isContainerReceived) {
                                        oItem.DeliveryFinalStatus = "Received";
                                    }

                                    //Remove Preceeding Zeros in DeliveryNumber
                                    if (oItem.DeliveryNumber) {
                                        oItem.DeliveryNumber = oItem.DeliveryNumber.replace(/^0+/, '') || "";
                                    }
                                    //DeliveryItem
                                    if (oItem.DeliveryItem) {
                                        oItem.DeliveryItem = oItem.DeliveryItem.replace(/^0+/, '') || "";
                                    }
                                    //ReturnDeliveryNumber
                                    if (oItem.ReturnDeliveryNumber) {
                                        oItem.ReturnDeliveryNumber = oItem.ReturnDeliveryNumber.replace(/^0+/, '') || "";
                                    }
                                    //ReturnDeliveryItem
                                    if (oItem.ReturnDeliveryItem) {
                                        oItem.ReturnDeliveryItem = oItem.ReturnDeliveryItem.replace(/^0+/, '') || "";
                                    }
                                    //Maintenance Order Type Mapping

                                    if (oItem.MaintenanceOrderType) {

                                        if (oItem.MaintenanceOrderType === "YBA1") {
                                            oItem.MaintenanceOrderType = oResourceBundle.getText("CorrectiveMaintenance.FLD");
                                        }
                                        else if (oItem.MaintenanceOrderType === "YBA2") {
                                            oItem.MaintenanceOrderType = oResourceBundle.getText("PreventiveMaintenance.FLD");
                                        }
                                        else if (oItem.MaintenanceOrderType === "YBA3") {
                                            oItem.MaintenanceOrderType = oResourceBundle.getText("UnplannedMaintenance.FLD");
                                        }
                                        else {
                                            oItem.MaintenanceOrderType
                                        }
                                        //  if (oItem.MaintenanceOrderType) {
                                        //     if (oItem.MaintenanceOrderType === "YBA1") {
                                        //         oItem.MaintenanceOrderType = "Corrective Maintenance";
                                        //     }
                                        //     else if (oItem.MaintenanceOrderType === "YBA2") {
                                        //         oItem.MaintenanceOrderType = "Preventive Maintenance";
                                        //     }
                                        //     else if (oItem.MaintenanceOrderType === "YBA3") {
                                        //         oItem.MaintenanceOrderType = "Unplanned Maintenance";
                                        //     }
                                        //     else {
                                        //         oItem.MaintenanceOrderType
                                        //     }
                                    }
                                    //Item Category Mapping
                                    var oItemCategoryMap = {
                                        L: oResourceBundle.getText("StockItem.FLD"),
                                        N: oResourceBundle.getText("Non-Stockitem.FLD")
                                    }
                                    if (oItem.MaintComponentItemCategory) {
                                        oItem.MaintComponentItemCategory = oItemCategoryMap[oItem.MaintComponentItemCategory]
                                            || oItem.MaintComponentItemCategory;
                                    }
                                    //Delivery Type & Return Delivery Type
                                    var oDeliveryTypeMap = {
                                        LO: oResourceBundle.getText("DeliverywoRef.FLD"),
                                        NL: oResourceBundle.getText('ReplenishmentDlv.FLD')
                                    }
                                    if (oItem.DeliveryDocumentType_Deli) {
                                        oItem.DeliveryDocumentType_Deli = oDeliveryTypeMap[oItem.DeliveryDocumentType_Deli] || oItem.DeliveryDocumentType_Deli
                                    }
                                    if (oItem.DeliveryDocumentType_RDeli) {
                                        oItem.DeliveryDocumentType_RDeli = oDeliveryTypeMap[oItem.DeliveryDocumentType_RDeli] || oItem.DeliveryDocumentType_RDeli
                                    }
                                    //Warehouse Task Status
                                    var oWHTaskStsMap = {
                                        '': oResourceBundle.getText("Open.FLD"),
                                        A: oResourceBundle.getText("Canceled.FLD"),
                                        B: oResourceBundle.getText("Waiting.FLD"),
                                        C: oResourceBundle.getText("Confirmed.FLD")
                                    }
                                    if (oItem.WarehouseTaskStatus) {
                                        oItem.WarehouseTaskStatus = oWHTaskStsMap[oItem.WarehouseTaskStatus] || oItem.WarehouseTaskStatus
                                    }
                                    // Delivery Picking Status, Delivery Goods Issue Status,ReturnDelivery Picking Status,Return Delivery Goods Issue Status
                                    var oDelStsMap = {
                                        '': oResourceBundle.getText("NotRelevant.FLD"),
                                        A: oResourceBundle.getText("Notyetprocessed.FLD"),
                                        B: oResourceBundle.getText("Partiallyprocessed.FLD"),
                                        C: oResourceBundle.getText("Completelyprocessed.FLD")
                                    }
                                    //Delivery Picking Status
                                    if (oItem.OvrlItmGeneralIncompletio_Deli) {
                                        oItem.OvrlItmGeneralIncompletio_Deli = oDelStsMap[oItem.OvrlItmGeneralIncompletio_Deli] || oItem.OvrlItmGeneralIncompletio_Deli
                                    }
                                    // Delivery Goods Issue Status
                                    if (oItem.OverallGoodsMovementStat_Deli) {
                                        oItem.OverallGoodsMovementStat_Deli = oDelStsMap[oItem.OverallGoodsMovementStat_Deli] || oItem.OverallGoodsMovementStat_Deli
                                    }
                                    //Return Deli Picking Status
                                    if (oItem.OvrlItmGeneralIncompletion_RDe) {
                                        oItem.OvrlItmGeneralIncompletion_RDe = oDelStsMap[oItem.OvrlItmGeneralIncompletion_RDe] || oItem.OvrlItmGeneralIncompletion_RDe
                                    }
                                    //Return Deli Goods Issue Status   
                                    if (oItem.OverallGoodsMovementSt_RDEL) {
                                        oItem.OverallGoodsMovementSt_RDEL = oDelStsMap[oItem.OverallGoodsMovementSt_RDEL] || oItem.OverallGoodsMovementSt_RDEL
                                    }
                                    //Voyage Status
                                    var oVoyStatusMap = {
                                        "01": oResourceBundle.getText("InTransit.FLD"),
                                        "02": oResourceBundle.getText("Arrived.FLD"),
                                        "03": oResourceBundle.getText("Completed.FLD"),
                                        "04": oResourceBundle.getText("NotStarted.FLD")
                                    }
                                    if (oItem.VoyStatus) {
                                        oItem.VoyStatus = oVoyStatusMap[oItem.VoyStatus] || oItem.VoyStatus
                                    }
                                    //Container Status
                                    var oContStatusMap = {
                                        "10": oResourceBundle.getText("Available.FLD"),
                                        "20": oResourceBundle.getText("Packed.FLD"),
                                        "30": oResourceBundle.getText("Inactive.FLD"),
                                        "99": oResourceBundle.getText("Deleted.FLD")
                                    }
                                    if (oItem.ContainerStatus) {
                                        oItem.ContainerStatus = oContStatusMap[oItem.ContainerStatus] || oItem.ContainerStatus
                                    }
                                });

                                oView.setBusy(false);
                                this.getView().getModel("trackModel").setProperty("/", aFinalData);
                                resolve(aFinalData);
                            }.bind(this)).catch(function (err) {
                                oView.setBusy(false);
                                reject(err);
                            });
                            //this.getView().getModel("trackModel").setProperty("/", aFinalData);
                            //resolve(aFinalData);
                        }.bind(this));

                    }.bind(this),
                    error: function (err) {
                        oView.setBusy(false);
                        reject(err);
                    }.bind(this)
                });
            });

        },

        //UCC DATA
        _getUCCDataMap: function (aMaintOrders, aDeliveryTokens) {

            var oModel = this.getOwnerComponent().getModel("YY1_FLG_WOREF_DELTYPE_API_CDS");
            var oUCCMap = new Map();
            var aFilters = [];
            return new Promise((resolve, reject) => {
                if (aMaintOrders && aMaintOrders.length > 0) {
                    aFilters = aMaintOrders.map(function (sOrder) {
                        return new sap.ui.model.Filter(
                            "MaintOrder",
                            sap.ui.model.FilterOperator.Contains,
                            sOrder
                        );
                    });
                }

                /* Delivery Filter */

                if (aDeliveryTokens && aDeliveryTokens.length > 0) {

                    var aDeliveryFilters = aDeliveryTokens.map(function (oToken) {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard ? sValue.replace(/\*/g, "") : sValue;
                        sFinalValue = sFinalValue?.padStart(10, '0');
                        return new sap.ui.model.Filter(
                            "DelNum",
                            sap.ui.model.FilterOperator.EQ,
                            sFinalValue
                        );

                    });

                    aFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliveryFilters,
                            and: false
                        })
                    );
                }
                if (aFilters.length === 0) {
                    resolve(oUCCMap);
                    return;
                }
                oModel.read("/YY1_FLG_WOREF_DELTYPE_API", {

                    // filters: [
                    //     new sap.ui.model.Filter({
                    //         filters: aFilters,
                    //         and: false
                    //     })
                    // ],
                    filters: aFilters,
                    success: function (oData) {

                        oData.results.forEach(function (item) {

                            var key = item.MaintOrder?.padStart(12, '0');

                            if (!oUCCMap.has(key)) {
                                oUCCMap.set(key, []);
                            }

                            oUCCMap.get(key).push(item);

                        });

                        resolve(oUCCMap);
                    },

                    error: reject
                });

            });
        },

        _getContainerDetails: async function (oItem) {
            const oModel = this.getOwnerComponent().getModel("shipmentcontainerunit");
            const sDeliveryNum = oItem.DeliveryNumber.replace(/^0+/, ''); //Deliverynumber
            const oListBinding = oModel.bindList("/ShipmentItem", null, null, [
                new sap.ui.model.Filter("DeliveryDocument", sap.ui.model.FilterOperator.EQ, sDeliveryNum)
            ]);
            //fldlogshipment container for container status
            const oContStatus = this.getOwnerComponent().getModel("fldlogsshipmentcontainer");
            try {
                const aContexts = await oListBinding.requestContexts();
                if (aContexts && aContexts.length > 0) {
                    const aData = aContexts.map(oCtx => oCtx.getObject());
                    oItem.ContainerID = aData.map(c => c.FldLogsContainerID).join(", ");
                   // oItem.ContainerStatus = aData[0].FldLogsContainerStatus;
                    const sContainerUUID = aData[0].FldLogsContainerUnitUUID;
                    if (oItem.ContainerID) {
                        const oContStatusBinding = oContStatus.bindList(
                            "/FldLogsShipmentContainer",
                            null,
                            null,
                            [
                                new sap.ui.model.Filter(
                                    "FldLogsContainerID",
                                    sap.ui.model.FilterOperator.EQ,
                                    oItem.ContainerID
                                )
                            ]
                        );
                        const aStatusContexts = await oContStatusBinding.requestContexts();
                        if (aStatusContexts && aStatusContexts.length > 0) {
                            const oStatus = aStatusContexts[0].getObject();
                            // Final Status Mapping
                            oItem.ContainerStatus = oStatus.FldLogsContainerStatus;
                        }

                    }
                    if (sContainerUUID) {
                        var voyage = await this._getVoyageDetails(oItem, sContainerUUID);
                    }
                } else {
                    oItem.ContainerID = "";
                    oItem.ContainerStatus = "";
                }
            } catch (oError) {
                console.error("V4 Fetch Failed for " + sDeliveryNum, oError);
            }
        },
        
        _getVoyageDetails: async function (oItem, sContainerUUID) {
            // Shipment Container Model
            const oModel = this.getOwnerComponent().getModel("shipmentcontainerunit");
            const sPath = "/ShipmentContainer(" + sContainerUUID + ")/_ShptStgeAssgmt";
            const oListBinding = oModel.bindList(sPath);
            // Voyage Model
            const oVoyageModel = this.getOwnerComponent().getModel("fldlogsshipmentvoyage");
            try {
                const aContexts = await oListBinding.requestContexts();
                if (aContexts && aContexts.length > 0) {
                    const oVoyageData = aContexts[0].getObject();
                    // Assign values from container API
                    oItem.VoyageNumber = oVoyageData.FldLogsShptVoyageNumber;
                    oItem.VoyageUUID = oVoyageData.FldLogsShptVoyageUUID;
                    oItem.VehicleName = oVoyageData.FldLogsShptVoyageVehicleName;
                    oItem.SourceStage = oVoyageData.FldLogsVoyageSrceStage;
                    oItem.DestStage = oVoyageData.FldLogsVoyageDestStage;
                    oItem.VoyageStatus = oVoyageData.FldLogsShptVoyageTypeCode;
                    // Voyage Number 
                    if (oVoyageData.FldLogsShptVoyageNumber) {
                        const oVoyListBinding = oVoyageModel.bindList(
                            "/FieldLogisticsShipmentVoyage",
                            null,
                            null,
                            [
                                new sap.ui.model.Filter(
                                    "FldLogsShptVoyageNumber",
                                    sap.ui.model.FilterOperator.EQ,
                                    oVoyageData.FldLogsShptVoyageNumber
                                )
                            ]
                        );

                        const aVoyContexts = await oVoyListBinding.requestContexts();

                        if (aVoyContexts && aVoyContexts.length > 0) {
                            const oVoyage = aVoyContexts[0].getObject();

                            // Final Status Mapping
                            oItem.VoyStatus = oVoyage.FldLogsShptVoyageStatusCode;
                        }
                    }

                } else {
                    oItem.VoyageNumber = "No Voyage Assigned";
                }

            } catch (oError) {
                console.error("Voyage Fetch Failed for Container " + sContainerUUID, oError);
            }
        },


        onFltrSearch: function () {

            var oTable = this.byId("idTabTrackList");
            var oBinding = oTable.getBinding("rows");

            var aMainFilters = [];

            /* ================= Maintenance Order ================= */

            var oMultiInputMO = this.byId("idFltrMo");
            this._addTokenFromValue(oMultiInputMO);
            var aMOTokens = oMultiInputMO.getTokens();
            if (aMOTokens.length > 0) {
                var aMOFilters = [];
                aMOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aMOFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrder",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aMOFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrder",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aMOFilters.length > 0) {

                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aMOFilters,
                            and: false
                        })
                    );
                }
            }

            /* Maintenance Order Desc  */

            var oMultiInputDesc = this.byId("idFltrMODesc");

            this._addTokenFromValue(oMultiInputDesc);

            var aDescTokens = oMultiInputDesc.getTokens();
            if (aDescTokens.length > 0) {
                var aDescFilters = [];

                aDescTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDescFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderDesc",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDescFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderDesc",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDescFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDescFilters,
                            and: false
                        })
                    );
                }
            }
            /* Reservation  */
            var oMultiInputReserve = this.byId("idFltrReserve");

            this._addTokenFromValue(oMultiInputReserve);

            var aReserveTokens = oMultiInputReserve.getTokens();
            if (aReserveTokens.length > 0) {
                var aReserveFilters = [];

                aReserveTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    //  Define Condition Case
                    if (oRange) {
                        var sValue1 = oRange.value1 || "";
                        var sValue2 = oRange.value2 || "";
                        // Padding logic
                        var sFinal1 = /^\d{10}$/.test(sValue1)
                            ? sValue1
                            : sValue1.padStart(10, "0");

                        var sFinal2 = /^\d{10}$/.test(sValue2)
                            ? sValue2
                            : sValue2.padStart(10, "0");

                        aReserveFilters.push(
                            new sap.ui.model.Filter(
                                "Reservation",
                                oRange.operation,
                                sFinal1,
                                sFinal2
                            )
                        );

                    }
                    // Normal Token Case
                    else {

                        var sValue = oToken.getKey() || "";

                        var bHasWildcard = sValue.includes("*");

                        var sCleanValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        // Padding logic
                        var sFinalValue = sCleanValue;
                        // var sFinalValue = /^\d{10}$/.test(sCleanValue)
                        //     ? sCleanValue
                        //     : sCleanValue.padStart(10, "0");

                        var sOperator = bHasWildcard
                            ? sap.ui.model.FilterOperator.Contains
                            : sap.ui.model.FilterOperator.EQ;

                        aReserveFilters.push(
                            new sap.ui.model.Filter(
                                "Reservation",
                                sOperator,
                                sFinalValue
                            )
                        );
                    }

                });

                // OR filter
                if (aReserveFilters.length > 0) {

                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aReserveFilters,
                            and: false
                        })
                    );
                }

            }
            /* Plant */

            var oMultiInputPlant = this.byId("idFltrPlant");

            this._addTokenFromValue(oMultiInputPlant);

            var aPlantTokens = oMultiInputPlant.getTokens();
            if (aPlantTokens.length > 0) {
                var aPlantFilters = [];

                aPlantTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aPlantFilters.push(
                            new sap.ui.model.Filter(
                                "Plant",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aPlantFilters.push(
                            new sap.ui.model.Filter(
                                "Plant",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aPlantFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aPlantFilters,
                            and: false
                        })
                    );
                }
            }
            /* MATERIAL  */

            var oMultiInputMaterial = this.byId("idFltrMaterial");

            this._addTokenFromValue(oMultiInputMaterial);

            var aMaterialTokens = oMultiInputMaterial.getTokens();
            if (aMaterialTokens.length > 0) {
                var aMaterialFilters = [];

                aMaterialTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDescFilters.push(
                            new sap.ui.model.Filter(
                                "Material",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aMaterialFilters.push(
                            new sap.ui.model.Filter(
                                "Material",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aMaterialFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aMaterialFilters,
                            and: false
                        })
                    );
                }
            }
            /* ================= Requirement Date ================= */

            var oDateRange = this.byId("idFltrReqDate");

            var dFrom = oDateRange.getDateValue();
            var dTo = oDateRange.getSecondDateValue();

            if (dFrom) {

                var sFrom = this._formatDate(dFrom);
                var sTo = this._formatDate(dTo ? dTo : dFrom);

                //  Date filter
                aMainFilters.push(
                    new sap.ui.model.Filter(
                        "RequirementDate",
                        sap.ui.model.FilterOperator.BT,
                        sFrom,
                        sTo
                    )
                );

            }

            /* SupplyPlantPO  */

            var oMultiInputSupplyPlantPO = this.byId("idFltrSupplyPlant");

            this._addTokenFromValue(oMultiInputSupplyPlantPO);

            var aSupplyPlantPOTokens = oMultiInputSupplyPlantPO.getTokens();
            if (aSupplyPlantPOTokens.length > 0) {
                var aSupplyPlantPOFilters = [];

                aSupplyPlantPOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aSupplyPlantPOFilters.push(
                            new sap.ui.model.Filter(
                                "SupplyingPlant_PO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aSupplyPlantPOFilters.push(
                            new sap.ui.model.Filter(
                                "SupplyingPlant_PO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aSupplyPlantPOFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aSupplyPlantPOFilters,
                            and: false
                        })
                    );
                }
            }
            //Supply Plant STO
            var oMultiInputSupplyPlantSTO = this.byId("idFltrSupplyPlantSTO");

            this._addTokenFromValue(oMultiInputSupplyPlantSTO);

            var aSupplyPlantSTOTokens = oMultiInputSupplyPlantSTO.getTokens();
            if (aSupplyPlantSTOTokens.length > 0) {
                var aSupplyPlantSTOFilters = [];

                aSupplyPlantSTOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aSupplyPlantPOFilters.push(
                            new sap.ui.model.Filter(
                                "SupplyingPlant_STO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aSupplyPlantSTOFilters.push(
                            new sap.ui.model.Filter(
                                "SupplyingPlant_STO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aSupplyPlantSTOFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aSupplyPlantSTOFilters,
                            and: false
                        })
                    );
                }
            }
            //MO Type
            var oMultiInputMOType = this.byId("idFltrMOType");

            this._addTokenFromValue(oMultiInputMOType);

            var aMOTypeTokens = oMultiInputMOType.getTokens();
            if (aMOTypeTokens.length > 0) {
                var aMOTypeFilters = [];

                aMOTypeTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aMOTypeFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderType",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aMOTypeFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderType",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aMOTypeFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aMOTypeFilters,
                            and: false
                        })
                    );
                }
            }
            //Basic Start Date
            var oMultiInputbasicStrtDt = this.byId("idFltrStrtdt");

            this._addTokenFromValue(oMultiInputbasicStrtDt);

            var abasicStrtDtTokens = oMultiInputbasicStrtDt.getTokens();
            if (abasicStrtDtTokens.length > 0) {
                var abasicStrtDtFilters = [];

                abasicStrtDtTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        abasicStrtDtFilters.push(
                            new sap.ui.model.Filter(
                                "MaintOrdBasicStartDate",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        abasicStrtDtFilters.push(
                            new sap.ui.model.Filter(
                                "MaintOrdBasicStartDate",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (abasicStrtDtFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: abasicStrtDtFilters,
                            and: false
                        })
                    );
                }
            }
            //Basic End Date
            var oMultiInputEndDt = this.byId("idFltrEndDt");

            this._addTokenFromValue(oMultiInputEndDt);

            var aEndDtTokens = oMultiInputEndDt.getTokens();
            if (aEndDtTokens.length > 0) {
                var aEndDtFilters = [];

                aEndDtTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aEndDtFilters.push(
                            new sap.ui.model.Filter(
                                "MaintOrdBasicEndDate",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aEndDtFilters.push(
                            new sap.ui.model.Filter(
                                "MaintOrdBasicEndDate",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aEndDtFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aEndDtFilters,
                            and: false
                        })
                    );
                }
            }
            //Operation
            var oMultiInputOperation = this.byId("idFltrOpr");

            this._addTokenFromValue(oMultiInputOperation);

            var aOperationTokens = oMultiInputOperation.getTokens();
            if (aOperationTokens.length > 0) {
                var aOperationFilters = [];

                aOperationTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aOperationFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderOperation",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aOperationFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderOperation",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aOperationFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aOperationFilters,
                            and: false
                        })
                    );
                }
            }
            //Reservation Item
            var oMultiInputResItemNo = this.byId("idFltrResItemNo");

            this._addTokenFromValue(oMultiInputResItemNo);

            var aResItemNoTokens = oMultiInputResItemNo.getTokens();
            if (aResItemNoTokens.length > 0) {
                var aResItemNoFilters = [];

                aResItemNoTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aResItemNoFilters.push(
                            new sap.ui.model.Filter(
                                "ReservationItem",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDescFilters.push(
                            new sap.ui.model.Filter(
                                "ReservationItem",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aResItemNoFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aResItemNoFilters,
                            and: false
                        })
                    );
                }
            }
            //Storage loc
            var oMultiInputSloc = this.byId("idFltrSloc");

            this._addTokenFromValue(oMultiInputSloc);

            var aSlocTokens = oMultiInputSloc.getTokens();
            if (aSlocTokens.length > 0) {
                var aSlocFilters = [];

                aSlocTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aSlocFilters.push(
                            new sap.ui.model.Filter(
                                "StorageLocation",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aSlocFilters.push(
                            new sap.ui.model.Filter(
                                "StorageLocation",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aSlocFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aSlocFilters,
                            and: false
                        })
                    );
                }
            }
            //Requestor
            var oMultiInputRequestor = this.byId("idFltrRequestor");

            this._addTokenFromValue(oMultiInputRequestor);

            var aRequestorTokens = oMultiInputRequestor.getTokens();
            if (aRequestorTokens.length > 0) {
                var aRequestorFilters = [];

                aRequestorTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aRequestorFilters.push(
                            new sap.ui.model.Filter(
                                "MaintOrdOpCompRequisitioner",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aRequestorFilters.push(
                            new sap.ui.model.Filter(
                                "MaintOrdOpCompRequisitioner",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aRequestorFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aRequestorFilters,
                            and: false
                        })
                    );
                }
            }
            // STO
            var oMultiInputSTO = this.byId("idFltrSTO");
            this._addTokenFromValue(oMultiInputSTO);
            var aSTOTokens = oMultiInputSTO.getTokens();
            if (aSTOTokens.length > 0) {
                var aSTOFilters = [];
                aSTOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aSTOFilters.push(
                            new sap.ui.model.Filter(
                                "STO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aSTOFilters.push(
                            new sap.ui.model.Filter(
                                "STO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aSTOFilters.length > 0) {

                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aSTOFilters,
                            and: false
                        })
                    );
                }
            }
            //PO
            var oMultiInputPO = this.byId("idFltrPO");

            this._addTokenFromValue(oMultiInputPO);

            var aPOTokens = oMultiInputPO.getTokens();
            if (aPOTokens.length > 0) {
                var aPOFilters = [];

                aPOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aPOFilters.push(
                            new sap.ui.model.Filter(
                                "PurchaseOrder",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aPOFilters.push(
                            new sap.ui.model.Filter(
                                "PurchaseOrder",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aPOFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aPOFilters,
                            and: false
                        })
                    );
                }
            }
            //IssueSLoc PO
            var oMultiInputIssueSLocPO = this.byId("idFltrIssueSLoc");

            this._addTokenFromValue(oMultiInputIssueSLocPO);

            var aIssueSLocPOTokens = oMultiInputIssueSLocPO.getTokens();
            if (aIssueSLocPOTokens.length > 0) {
                var aIssueSLocPOFilters = [];

                aIssueSLocPOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aIssueSLocPOFilters.push(
                            new sap.ui.model.Filter(
                                "IssuingStorageLocation_PO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aIssueSLocPOFilters.push(
                            new sap.ui.model.Filter(
                                "IssuingStorageLocation_PO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aIssueSLocPOFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aIssueSLocPOFilters,
                            and: false
                        })
                    );
                }
            }
            //Supplier PO
            var oMultiInputSupplier = this.byId("idFltrSupplier");

            this._addTokenFromValue(oMultiInputSupplier);

            var aSupplierTokens = oMultiInputSupplier.getTokens();
            if (aSupplierTokens.length > 0) {
                var aSupplierFilters = [];

                aSupplierTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aSupplierFilters.push(
                            new sap.ui.model.Filter(
                                "Supplier_PO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aSupplierFilters.push(
                            new sap.ui.model.Filter(
                                "Supplier_PO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aSupplierFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aSupplierFilters,
                            and: false
                        })
                    );
                }
            }
            //DeliveryDate PO
            var oMultiInputDeliveryDate = this.byId("idFltrDeliveryDate");

            this._addTokenFromValue(oMultiInputDeliveryDate);

            var aDeliveryDateTokens = oMultiInputDeliveryDate.getTokens();
            if (aDeliveryDateTokens.length > 0) {
                var aDeliveryDateFilters = [];

                aDeliveryDateTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDeliveryDateFilters.push(
                            new sap.ui.model.Filter(
                                "YY1_DELIVERYDATE_PDI_PO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDeliveryDateFilters.push(
                            new sap.ui.model.Filter(
                                "YY1_DELIVERYDATE_PDI_PO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliveryDateFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliveryDateFilters,
                            and: false
                        })
                    );
                }
            }
            //DeliveryCrtDate
            var oMultiInputDeliveryCrtDate = this.byId("idFltrDeliveryCrtDate");

            this._addTokenFromValue(oMultiInputDeliveryCrtDate);

            var aDeliveryCrtDateTokens = oMultiInputDeliveryCrtDate.getTokens();
            if (aDeliveryCrtDateTokens.length > 0) {
                var aDeliveryCrtDateFilters = [];

                aDeliveryCrtDateTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDeliveryCrtDateFilters.push(
                            new sap.ui.model.Filter(
                                "DeliveryCreationDate",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDeliveryCrtDateFilters.push(
                            new sap.ui.model.Filter(
                                "DeliveryCreationDate",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliveryCrtDateFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliveryCrtDateFilters,
                            and: false
                        })
                    );
                }
            }
            //Delivery
            var oMultiInputDelivery = this.byId("idFltrDelivery");

            this._addTokenFromValue(oMultiInputDelivery);

            var aDeliveryTokens = oMultiInputDelivery.getTokens();
            if (aDeliveryTokens.length > 0) {
                var aDeliveryFilters = [];

                aDeliveryTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        if (oRange.operation === "Equal") {
                            oRange.value1 = oRange.value1?.padStart(10, '0')
                            oRange.value2 = oRange.value2?.padStart(10, '0')
                        }
                        aDeliveryFilters.push(
                            new sap.ui.model.Filter(
                                "DeliveryNumber",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;
                        if (!bHasWildcard) {
                            sFinalValue = sFinalValue?.padStart(10, '0');
                        }

                        aDeliveryFilters.push(
                            new sap.ui.model.Filter(
                                "DeliveryNumber",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliveryFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliveryFilters,
                            and: false
                        })
                    );

                }
                this._deliveryTokens = aDeliveryTokens;
            }

            //DeliveryPickingdate - Delivery
            var oMultiInputDeliveryPickingdate = this.byId("idFltrDeliveryPickingdate");

            this._addTokenFromValue(oMultiInputDeliveryPickingdate);

            var aDeliveryPickingdateTokens = oMultiInputDeliveryPickingdate.getTokens();
            if (aDeliveryPickingdateTokens.length > 0) {
                var aDeliveryPickingdateFilters = [];

                aDeliveryPickingdateTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDeliveryPickingdateFilters.push(
                            new sap.ui.model.Filter(
                                "PickingDate_Deli",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDeliveryPickingdateFilters.push(
                            new sap.ui.model.Filter(
                                "PickingDate_Deli",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliveryPickingdateFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliveryPickingdateFilters,
                            and: false
                        })
                    );
                }
            }
            //DeliverPickingstatus - Delivery
            var oMultiInputDeliverPickingstatus = this.byId("idFltrDeliverPickingstatus");

            this._addTokenFromValue(oMultiInputDeliverPickingstatus);

            var aDeliverPickingstatusTokens = oMultiInputDeliverPickingstatus.getTokens();
            if (aDeliverPickingstatusTokens.length > 0) {
                var aDeliverPickingstatusFilters = [];

                aDeliverPickingstatusTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDeliverPickingstatusFilters.push(
                            new sap.ui.model.Filter(
                                "OvrlItmGeneralIncompletio_Deli",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDeliverPickingstatusFilters.push(
                            new sap.ui.model.Filter(
                                "OvrlItmGeneralIncompletio_Deli",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliverPickingstatusFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliverPickingstatusFilters,
                            and: false
                        })
                    );
                }
            }
            //DelActGoodsIssuDate
            var oMultiInputDelActGoodsIssuDate = this.byId("idFltrDelActGoodsIssuDate");

            this._addTokenFromValue(oMultiInputDelActGoodsIssuDate);

            var aDelActGoodsIssuDateTokens = oMultiInputDelActGoodsIssuDate.getTokens();
            if (aDelActGoodsIssuDateTokens.length > 0) {
                var aDelActGoodsIssuDateFilters = [];

                aDelActGoodsIssuDateTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDelActGoodsIssuDateFilters.push(
                            new sap.ui.model.Filter(
                                "ActualGoodsMovementDa_Deli",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDelActGoodsIssuDateFilters.push(
                            new sap.ui.model.Filter(
                                "ActualGoodsMovementDa_Deli",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDelActGoodsIssuDateFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDelActGoodsIssuDateFilters,
                            and: false
                        })
                    );
                }
            }
            //DeliPlndGoodsIssuDate
            var oMultiInputDeliPlndGoodsIssuDate = this.byId("idFltrDeliPlndGoodsIssuDate");

            this._addTokenFromValue(oMultiInputDeliPlndGoodsIssuDate);

            var aDeliPlndGoodsIssuDateTokens = oMultiInputDeliPlndGoodsIssuDate.getTokens();
            if (aDeliPlndGoodsIssuDateTokens.length > 0) {
                var aDeliPlndGoodsIssuDateFilters = [];

                aDeliPlndGoodsIssuDateTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDeliPlndGoodsIssuDateFilters.push(
                            new sap.ui.model.Filter(
                                "PlannedGoodsIssueDate_Deli",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDeliPlndGoodsIssuDateFilters.push(
                            new sap.ui.model.Filter(
                                "PlannedGoodsIssueDate_Deli",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliPlndGoodsIssuDateFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliPlndGoodsIssuDateFilters,
                            and: false
                        })
                    );
                }
            }
            //Deliveryfinalstatus
            var oMultiInputDeliveryfinalstatus = this.byId("idFltrDeliveryfinalstatus");

            this._addTokenFromValue(oMultiInputDeliveryfinalstatus);

            var aDeliveryfinalstatusTokens = oMultiInputDeliveryfinalstatus.getTokens();
            if (aDeliveryfinalstatusTokens.length > 0) {
                var aDeliveryfinalstatusFilters = [];

                aDeliveryfinalstatusTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aDeliveryfinalstatusFilters.push(
                            new sap.ui.model.Filter(
                                "DeliveryFinalStatus",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aDeliveryfinalstatusFilters.push(
                            new sap.ui.model.Filter(
                                "DeliveryFinalStatus",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aDeliveryfinalstatusFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aDeliveryfinalstatusFilters,
                            and: false
                        })
                    );
                }
            }
            //ReturnSTO
            var oMultiInputReturnSTO = this.byId("idFltrReturnSTO");

            this._addTokenFromValue(oMultiInputReturnSTO);

            var aReturnSTOTokens = oMultiInputReturnSTO.getTokens();
            if (aReturnSTOTokens.length > 0) {
                var aReturnSTOFilters = [];

                aReturnSTOTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aReturnSTOFilters.push(
                            new sap.ui.model.Filter(
                                "ReturnSTO",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aReturnSTOFilters.push(
                            new sap.ui.model.Filter(
                                "ReturnSTO",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aReturnSTOFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aReturnSTOFilters,
                            and: false
                        })
                    );
                }
            }
            //Purchase Req
            var oMultiInputPurReq = this.byId("idFltrPurReq");

            this._addTokenFromValue(oMultiInputPurReq);

            var aPurReqTokens = oMultiInputPurReq.getTokens();
            if (aPurReqTokens.length > 0) {
                var aPurReqFilters = [];

                aPurReqTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aPurReqFilters.push(
                            new sap.ui.model.Filter(
                                "PurchaseRequisition",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aPurReqFilters.push(
                            new sap.ui.model.Filter(
                                "PurchaseRequisition",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aPurReqFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aPurReqFilters,
                            and: false
                        })
                    );
                }
            }
            //ReturnDeliverySupplier
            var oMultiInputReturnDeliverySupplier = this.byId("idFltrReturnDeliverySupplier");

            this._addTokenFromValue(oMultiInputReturnDeliverySupplier);

            var aReturnDeliverySupplierTokens = oMultiInputReturnDeliverySupplier.getTokens();
            if (aReturnDeliverySupplierTokens.length > 0) {
                var aReturnDeliverySupplierFilters = [];

                aReturnDeliverySupplierTokens.forEach(function (oToken) {
                    var oRange = oToken.data("range");
                    if (oRange) {
                        aReturnDeliverySupplierFilters.push(
                            new sap.ui.model.Filter(
                                "Supplier_WOREF",
                                oRange.operation,
                                oRange.value1,
                                oRange.value2
                            )
                        );

                    } else {
                        var sValue = oToken.getKey() || "";
                        var bHasWildcard = sValue.includes("*");
                        var sFinalValue = bHasWildcard
                            ? sValue.replace(/\*/g, "")
                            : sValue;

                        aReturnDeliverySupplierFilters.push(
                            new sap.ui.model.Filter(
                                "Supplier_WOREF",
                                bHasWildcard
                                    ? sap.ui.model.FilterOperator.Contains
                                    : sap.ui.model.FilterOperator.EQ,
                                sFinalValue
                            )
                        );
                    }
                });

                if (aReturnDeliverySupplierFilters.length > 0) {
                    aMainFilters.push(
                        new sap.ui.model.Filter({
                            filters: aReturnDeliverySupplierFilters,
                            and: false
                        })
                    );
                }

            }

            //Apply Filters to load the data
            if (!aMainFilters || aMainFilters.length === 0) {
                sap.m.MessageToast.show("Please select at least one filter");
                return; // stop loading
            }
            else {
                this._loadTrackdata(aMainFilters)
                    .then(function (aData) {
                        console.log("Data loaded and deduplicated:", aData.length);
                    })
                    .catch(function (err) {

                        sap.m.MessageToast.show("Error loading data");
                    });
            }
            //oBinding.filter(aMainFilters);
        },


        // HELPER FUNCTION – ADD TOKEN IF USER TYPED VALUE      


        _addTokenFromValue: function (oMultiInput) {

            var sValue = oMultiInput.getValue();

            if (sValue) {
                oMultiInput.addToken(
                    new sap.m.Token({
                        key: sValue,
                        text: sValue
                    })
                );
                oMultiInput.setValue("");
            }
        },

        _formatDate: function (oDate) {

            var y = oDate.getFullYear();
            var m = String(oDate.getMonth() + 1).padStart(2, '0');
            var d = String(oDate.getDate()).padStart(2, '0');

            return y + "-" + m + "-" + d; // YYYY-MM-DD
        },
        onPressSettings: function () {
            if (!this._oSettingDialog) {
                this._oSettingDialog = new sap.m.P13nDialog({
                    title: "Table Settings",
                    panels: [new sap.m.P13nColumnsPanel({
                        title: "Columns",
                        visible: true
                    })],
                    // Attach handlers once during creation
                    ok: function (oEvent) {
                        var aItems = oEvent.getParameter("payload").columns.tableItems;
                        var oTable = this.byId("idTabTrackList");

                        var aExistingColumns = oTable.getColumns();

                        // Get current order of column IDs
                        var aCurrentOrder = aExistingColumns.map(function (oCol) {
                            return oCol.getId();
                        });

                        // Get new order from dialog
                        var aNewOrder = aItems.map(function (oItem) {
                            return oItem.columnKey;
                        });

                        // Check if order changed
                        var bOrderChanged = aCurrentOrder.length !== aNewOrder.length ||
                            aCurrentOrder.some(function (sKey, index) {
                                return sKey !== aNewOrder[index];
                            });
                        aItems.forEach(function (oItem) {
                            var oColumn = this.getView().byId(oItem.columnKey);
                            if (oColumn) {
                                oColumn.setVisible(oItem.visible);
                            }
                        }.bind(this));
                        // Reorder ONLY if changed
                        if (bOrderChanged) {
                            oTable.removeAllColumns();

                            aItems.forEach(function (oItem) {
                                var oColumn = this.getView().byId(oItem.columnKey);
                                if (oColumn) {
                                    oTable.addColumn(oColumn);
                                }
                            }.bind(this));
                        }
                        this.oSmartVariantManagement.currentVariantSetModified(true);

                        this._oSettingDialog.close();
                    }.bind(this),
                    cancel: function () {
                        this._oSettingDialog.close();
                    }.bind(this)
                });
                this.getView().addDependent(this._oSettingDialog);
            }
            this._loadColumns();
            this._oSettingDialog.open();
        },

        _loadColumns: function () {

            var oTable = this.byId("idTabTrackList");
            var aColumns = oTable.getColumns();
            var oPanel = this._oSettingDialog.getPanels()[0];
            oPanel.removeAllItems();

            aColumns.forEach(function (oColumn, index) {
                oPanel.addItem(new sap.m.P13nItem({
                    columnKey: oColumn.getId(),
                    text: oColumn.getLabel().getText(),
                    visible: oColumn.getVisible()

                }));

            });
        },
        onMaterialLinkPress: async function (oEvent) {
            // Get the clicked row's context
            var oContext = oEvent.getSource().getBindingContext("trackModel");
            console.log(oContext.getObject());
            var sFieldValue = oContext.getProperty("StockReport");

            // // Encode the value for safe URL usage
            // var sEncodedValue = encodeURIComponent(sFieldValue);

            // // Build the target app URL
            // var sTargetUrl = "https://repsolsinopecuk-irpaq.launchpad.cfapps.eu10.hana.ondemand.com/site?siteId=ef7e2ae1-bb99-4397-ad74-3b52b74804ca#yy1_invman-display?Product=" + sEncodedValue;


            // // Navigate to the target app
            // // window.location.href = sTargetUrl; //Same page
            // window.open(sTargetUrl, "_blank");   //New Pagee

            var oNavigation = await sap.ushell.Container.getServiceAsync("Navigation");

            oNavigation.navigate({
                target: { semanticObject: "yy1_invman", action: "display" },
                params: { Product: sFieldValue, "sap-ushell-navmode": "explace" }
            });

        },
        onSortTrackTbl: function (oEvent) {
            var oColumn = oEvent.getParameter("column");
            var sSortProperty = oColumn.getSortProperty();
            var oBinding = this.byId("idTabTrackList").getBinding("rows");

            var bDescending = oEvent.getParameter("sortOrder") === "Descending";

            oBinding.sort(new sap.ui.model.Sorter(sSortProperty, bDescending));
        },
        onExcelExport: async function () {
            var oTable = this.byId("idTabTrackList");
            var oBinding = oTable.getBinding("rows");

            // Define columns for export
            var aCols = oTable.getColumns().filter(function (oColumn) {
                return oColumn.getVisible();
            }).map(function (oColumn) {
                var sProperty = oColumn.getTemplate().getBindingPath("text");
                var oCol = {
                    label: oColumn.getLabel().getText(),
                    property: sProperty,
                    type: "String"
                };
                // Apply date formatting for specific columns
                if (sProperty === "MaintOrdBasicStartDate" || sProperty === "MaintOrdBasicEndDate"
                    || sProperty === "RequirementDate" || sProperty === "PostingDate_PO"
                    || sProperty === "PostingDate_STO" || sProperty === "PostingDate_RTO"
                    || sProperty === "PickingDate_Deli" || sProperty === "ActualGoodsMovementDa_Deli"
                    || sProperty === "PlannedGoodsIssueDate_Deli" || sProperty === "PickingDate_RDeli"
                    || sProperty === "ActualGoodsMovementD_RDel" || sProperty === "PlannedGoodsIssueDate_RDeli"
                ) {
                    oCol.type = "Date";
                    oCol.format = "dd-MM-yyyy"; // Format
                }

                return oCol;
            });

            // Fetch table data
            var iLength = oBinding.getLength();
            var aContexts = await oBinding.getContexts(0, iLength);
            var aData = aContexts.map(function (oContext) {
                //return oContext.getObject();
                var oObj = Object.assign({}, oContext.getObject()); // clone object

                // // Convert to JS Date to avoid timezone issues
                // if (oObj.MaintOrdBasicStartDate) {
                //     oObj.MaintOrdBasicStartDate = new Date(oObj.MaintOrdBasicStartDate);
                //     //var dStart = new Date(oObj.MaintOrdBasicStartDate);
                //     // oObj.MaintOrdBasicStartDate = new Date(
                //     //     dStart.getFullYear(),
                //     //     dStart.getMonth(),
                //     //     dStart.getDate()
                //     // );
                // }

                // if (oObj.MaintOrdBasicEndDate) {
                //     oObj.MaintOrdBasicEndDate = new Date(oObj.MaintOrdBasicEndDate);
                //     //var dEnd = new Date(oObj.MaintOrdBasicEndDate);
                //     // oObj.MaintOrdBasicEndDate = new Date(
                //     //     dEnd.getFullYear(),
                //     //     dEnd.getMonth(),
                //     //     dEnd.getDate()

                //     // );
                // }
                // if (oObj.RequirementDate) {
                //     oObj.RequirementDate = new Date(oObj.RequirementDate);
                // }
                // if (oObj.PostingDate_PO) {
                //     oObj.PostingDate_PO = new Date(oObj.PostingDate_PO);
                // }
                // if (oObj.PostingDate_STO) {
                //     oObj.PostingDate_STO = new Date(oObj.PostingDate_STO);
                // }
                // if (oObj.PostingDate_RTO) {
                //     oObj.PostingDate_RTO = new Date(oObj.PostingDate_RTO);
                // }
                // if (oObj.PickingDate_Deli) {
                //     oObj.PickingDate_Deli = new Date(oObj.PickingDate_Deli);
                // }
                // if (oObj.ActualGoodsMovementDa_Deli) {
                //     oObj.ActualGoodsMovementDa_Deli = new Date(oObj.ActualGoodsMovementDa_Deli);
                // }
                // if (oObj.PlannedGoodsIssueDate_Deli) {
                //     oObj.PlannedGoodsIssueDate_Deli = new Date(oObj.PlannedGoodsIssueDate_Deli);
                // }
                // if (oObj.PickingDate_RDeli) {
                //     oObj.PickingDate_RDeli = new Date(oObj.PickingDate_RDeli);
                // }
                // if (oObj.ActualGoodsMovementD_RDel) {
                //     oObj.ActualGoodsMovementD_RDel = new Date(oObj.ActualGoodsMovementD_RDel);
                // }
                // if (oObj.PlannedGoodsIssueDate_RDeli) {
                //     oObj.PlannedGoodsIssueDate_RDeli = new Date(oObj.PlannedGoodsIssueDate_RDeli);
                // }
                return oObj;
            });

            // Configure spreadsheet settings
            var oSettings = {
                workbook: { columns: aCols },
                dataSource: aData,
                fileName: "TrackingExportedData.xlsx",
                worker: false
            };

            // Create and build the spreadsheet
            var oSpreadsheet = new Spreadsheet(oSettings);
            oSpreadsheet.build()
                .then(function () {
                    MessageToast.show("Export successful!");
                })
                .finally(function () {
                    oSpreadsheet.destroy();
                });
        },

        //MaintOrder
        // onMaintOrderVHRqst: function () {
        //     //Load the Fragment to Open Popup
        //     if (!this._oMaintOrderPopDialog) {
        //         this.loadFragment({
        //             name: "ns.flgmat.dialogs.MaintOrderVH",
        //             addToDependents: true
        //         }).then(function (oDialog) {
        //             this._oMaintOrderPopDialog = oDialog;
        //             this._oMaintOrderPopDialog.open();
        //         }.bind(this));
        //     } else {
        //         this._oMaintOrderPopDialog.open();
        //     }
        // },
        onPressCancelMODialog: function () {
            //  Close the  Dialog
            if (this._oMaintOrderPopDialog) {
                this._oMaintOrderPopDialog.close();
            }
        },

        onBeforeRebindTableMO: function (oEvent) {

            var oBindingParams = oEvent.getParameter("bindingParams");

            //  Force only required fields (avoid unwanted joins impact)
            oBindingParams.parameters = oBindingParams.parameters || {};
            oBindingParams.parameters.$select = "MaintenanceOrder,MaintenanceOrderDesc";

            //  reduce duplicate impact (only works if backend supports)
            oBindingParams.parameters.$orderby = "MaintenanceOrder";

        },

        onPressOKMODialog: function () {

            var oSmartTable = this.byId("idSMTMaintOrder");
            var oTable = oSmartTable.getTable();

            var oMultiInput = this.byId("idFltrMo");


            oMultiInput.removeAllTokens();

            var aSelectedIndices = oTable.getSelectedIndices();

            if (!aSelectedIndices.length) {
                sap.m.MessageToast.show("Please select at least one row");
                return;
            }

            aSelectedIndices.forEach(function (iIndex) {

                var oContext = oTable.getContextByIndex(iIndex);
                var oData = oContext.getObject();

                var sOrder = oData.MaintenanceOrder;
                var sDesc = oData.MaintenanceOrderDesc;

                // Avoid duplicate tokens
                var bExists = oMultiInput.getTokens().some(function (oToken) {
                    return oToken.getKey() === sOrder;
                });

                if (!bExists) {
                    oMultiInput.addToken(new sap.m.Token({
                        key: sOrder,                 // backend value
                        text: sOrder

                    }));
                }

            });

            this.byId("idMODialog").close();
        },

        onMaintOrderVHRqst: function () {

            if (!this._oMaintOrderVH) {

                this._oMaintOrderVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Maintenance Order",
                    supportMultiselect: true,
                    key: "MaintenanceOrder",
                    descriptionKey: "MaintenanceOrderDesc",
                    supportRanges: true,          // Enables "Define Conditions"
                    supportRangesOnly: false,

                    ok: function (oEvent) {

                        var oMultiInput = this.byId("idFltrMo");
                        oMultiInput.removeAllTokens();

                        oEvent.getParameter("tokens").forEach(function (oToken) {
                            var oRangeData = oToken.data("range");
                            // Handle Define Conditions
                            if (oRangeData) {

                                var sValue = oRangeData.value1;

                                if (oRangeData.value2) {
                                    sValue = oRangeData.value1 + "..." + oRangeData.value2;
                                }
                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                                oMultiInput.data("range", oRangeData);
                            }
                            // Normal Selection
                            else {
                                oMultiInput.addToken(new sap.m.Token({
                                    key: oToken.getKey(),
                                    text: oToken.getKey()
                                }));
                            }

                        });

                        this._oMaintOrderVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oMaintOrderVH.close();
                    }.bind(this)
                });

                this.getView().addDependent(this._oMaintOrderVH);

                this._oMaintOrderVH.setFilterBar(this._createFilterBar(this._oMaintOrderVH,));
                this._prepareTable(this._oMaintOrderVH);
                // Only MaintenanceOrder in Define Conditions
                this._oMaintOrderVH.setRangeKeyFields([
                    {
                        label: "Maintenance Order",
                        key: "MaintenanceOrder",
                        type: "string"
                    }
                ]);
            }

            this._loadMaintOrders("", this._oMaintOrderVH);
            this._oMaintOrderVH.open();
        },
        onMODescVHRqst: function () {

            if (!this._oMaintDescVH) {

                this._oMaintDescVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Maintenance Order Description",
                    supportMultiselect: true,
                    key: "MaintenanceOrder",
                    descriptionKey: "MaintenanceOrderDesc",
                    supportRanges: true,          // Enables "Define Conditions"
                    supportRangesOnly: false,

                    ok: function (oEvent) {

                        var oMultiInput = this.byId("idFltrMODesc");
                        oMultiInput.removeAllTokens();

                        oEvent.getParameter("tokens").forEach(function (oToken) {


                            var oRangeData = oToken.data("range");

                            // Define Conditions
                            if (oRangeData) {

                                var sValue = oRangeData.value1;

                                if (oRangeData.value2) {
                                    sValue = oRangeData.value1 + "..." + oRangeData.value2;
                                }

                                var oNewToken = new sap.m.Token({
                                    key: sValue,
                                    text: oToken.getText()
                                });

                                oNewToken.data("range", oRangeData);

                                oMultiInput.addToken(oNewToken);
                            }
                            else {
                                var sKey = oToken.getKey(); // backend
                                var sDesc = "";

                                var oContext = oToken.getBindingContext();

                                //  Get only Description from model
                                if (oContext) {
                                    sDesc = oContext.getProperty("MaintenanceOrderDesc");
                                } else {
                                    //  fallback (important)
                                    var sText = oToken.getText ? oToken.getText() : "";

                                    if (sText.includes("(")) {
                                        sDesc = sText.split("(")[0].trim();
                                    } else if (sText.includes("-")) {
                                        sDesc = sText.split("-")[1].trim();
                                    } else {
                                        sDesc = sText;
                                    }
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sDesc,
                                    text: sDesc
                                }));
                            }

                        });

                        this._oMaintDescVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oMaintDescVH.close();
                    }.bind(this)
                });
                //this._oMaintVH.setTokenDisplayBehaviour("descriptionOnly");
                this.getView().addDependent(this._oMaintDescVH);

                this._oMaintDescVH.setFilterBar(this._createFilterBar(this._oMaintDescVH));
                this._prepareTable(this._oMaintDescVH);
                // Only MaintenanceOrderDesc in Define Conditions
                this._oMaintDescVH.setRangeKeyFields([
                    {
                        label: "Maintenance Order Description",
                        key: "MaintenanceOrderDesc",
                        type: "string"
                    }
                ]);
            }

            this._loadMaintOrders("", this._oMaintDescVH);
            this._oMaintDescVH.open();
        },
        // _createFilterBar: function (oVH) {

        //     var oInput = new sap.m.Input({ placeholder: "Search Maintenance Order / Maximo Work Order" });

        //     var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
        //         advancedMode: true,
        //         filterBarExpanded: true,

        //         search: function () {
        //             this._loadMaintOrders(oInput.getValue(), oVH);
        //         }.bind(this)
        //     });
        //    // oFilterBar.setBasicSearch(oInput);

        //     oFilterBar.addFilterItem(new sap.ui.comp.filterbar.FilterItem({
        //         name: "MaintOrder/WorkOrder",
        //         label: "MaintOrder / Maximo WorkOrder",
        //         control: oInput
        //     }));

        //     return oFilterBar;
        // },
        _createFilterBar: function (oVH) {

            var oMOInput = new sap.m.Input({
                placeholder: "Enter Maintenance Order"
            });

            var oDescInput = new sap.m.Input({
                placeholder: "Maximo WorkOrder"
            });

            var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
                advancedMode: true,
                filterBarExpanded: true,

                search: function () {

                    var sMO = oMOInput.getValue();
                    var sDesc = oDescInput.getValue();

                    var oModel = this.getOwnerComponent().getModel();
                    var aFilters = [];

                    if (sMO) {
                        aFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrder",
                                sap.ui.model.FilterOperator.Contains,
                                sMO
                            )
                        );
                    }

                    if (sDesc) {
                        aFilters.push(
                            new sap.ui.model.Filter(
                                "MaintenanceOrderDesc",
                                sap.ui.model.FilterOperator.Contains,
                                sDesc
                            )
                        );
                    }

                    oModel.read("/YY1_FLGTRK_Tracking_API", {

                        filters: aFilters,

                        success: function (oData) {

                            var oMap = new Map();

                            oData.results.forEach(function (oItem) {
                                if (!oMap.has(oItem.MaintenanceOrder)) {
                                    oMap.set(oItem.MaintenanceOrder, oItem);
                                }
                            });

                            var aData = Array.from(oMap.values());

                            var oVHModel = new sap.ui.model.json.JSONModel(aData);

                            oVH.getTableAsync().then(function (oTable) {
                                oTable.setModel(oVHModel);
                                oTable.bindRows("/");
                            });

                        },

                        error: function () {
                            sap.m.MessageToast.show("Load failed");
                        }
                    });

                }.bind(this)
            });

            // Maintenance Order
            oFilterBar.addFilterItem(
                new sap.ui.comp.filterbar.FilterItem({
                    name: "MaintenanceOrder",
                    label: "Maintenance Order",
                    control: oMOInput
                })
            );

            // Description
            oFilterBar.addFilterItem(
                new sap.ui.comp.filterbar.FilterItem({
                    name: "MaintenanceOrderDesc",
                    label: "Maximo Work Order",
                    control: oDescInput
                })
            );

            // Initial load
            setTimeout(function () {
                oFilterBar.fireSearch();
            }, 200);

            return oFilterBar;
        },

        _prepareTable: function (oVH) {

            oVH.getTableAsync().then(function (oTable) {

                oTable.addColumn(new sap.ui.table.Column({
                    label: new sap.m.Label({ text: "Maintenance Order" }),
                    template: new sap.m.Text({ text: "{MaintenanceOrder}" })
                }));

                oTable.addColumn(new sap.ui.table.Column({
                    label: new sap.m.Label({ text: "Description" }),
                    template: new sap.m.Text({ text: "{MaintenanceOrderDesc}" })
                }));

                oTable.setSelectionMode("MultiToggle");

                oVH.update();

            });
        },
        _loadMaintOrders: function (sValue, oVH) {

            var oModel = this.getView().getModel();
            var aFilters = [];

            if (sValue) {
                aFilters.push(new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("MaintenanceOrder", sap.ui.model.FilterOperator.Contains, sValue),
                        new sap.ui.model.Filter("MaintenanceOrderDesc", sap.ui.model.FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }

            oModel.read("/YY1_FLGTRK_Tracking_API", {

                filters: aFilters,

                urlParameters: {
                    $select: "MaintenanceOrder,MaintenanceOrderDesc",
                    $top: 10000
                },

                success: function (oData) {

                    var oMap = new Map();

                    oData.results.forEach(function (oItem) {
                        if (!oMap.has(oItem.MaintenanceOrder)) {
                            oMap.set(oItem.MaintenanceOrder, oItem);
                        }
                    });

                    var aData = Array.from(oMap.values());

                    var oVHModel = new sap.ui.model.json.JSONModel(aData);

                    oVH.getTableAsync().then(function (oTable) {
                        oTable.setModel(oVHModel);
                        oTable.bindRows("/");
                    });

                },

                error: function () {
                    sap.m.MessageToast.show("Load failed");
                }
            });
        },


        onReservVHRqst: function () {

            if (!this._oReserveVH) {

                // MultiInput for FilterBar
                var oFilterMultiInput = new sap.m.MultiInput({
                    placeholder: "Search Reservation"
                });

                // Allow typing + Enter → token
                oFilterMultiInput.attachSubmit(function (oEvent) {
                    var sValue = oEvent.getSource().getValue();
                    if (sValue) {
                        oEvent.getSource().addToken(new sap.m.Token({
                            key: sValue,
                            text: sValue
                        }));
                        oEvent.getSource().setValue("");
                    }
                });

                // FilterBar
                var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
                    advancedMode: true,
                    filterBarExpanded: true,

                    search: function () {

                        var aTokens = oFilterMultiInput.getTokens();
                        var aFilters = [];

                        // Convert tokens → filters
                        aTokens.forEach(function (oToken) {
                            var sValue = oToken.getKey() || oToken.getText();

                            aFilters.push(new sap.ui.model.Filter(
                                "Reservation",
                                sap.ui.model.FilterOperator.Contains,
                                sValue
                            ));
                        });

                        this._loadMaintOrdersReserve(aFilters);

                    }.bind(this)
                });

                // Add MultiInput to FilterBar
                oFilterBar.addFilterItem(new sap.ui.comp.filterbar.FilterItem({
                    name: "Reservation",
                    label: "Reservation",
                    control: oFilterMultiInput
                }));


                //  ValueHelpDialog
                this._oReserveVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Reservation",
                    supportMultiselect: true,
                    supportRanges: true,          // Enables "Define Conditions"
                    supportRangesOnly: false,
                    key: "Reservation",

                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrReserve");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {

                            var oRangeData = oToken.data("range");

                            // Handle Define Conditions
                            if (oRangeData) {

                                var sValue = oRangeData.value1;

                                if (oRangeData.value2) {
                                    sValue = oRangeData.value1 + "..." + oRangeData.value2;
                                }
                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                                oMultiInput.data("range", oRangeData);
                            }
                            // Normal Selection
                            else {
                                var sKey = oToken.getKey();

                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });

                        this._oReserveVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oReserveVH.close();
                    }.bind(this)
                });

                this.getView().addDependent(this._oReserveVH);

                // Attach FilterBar
                this._oReserveVH.setFilterBar(oFilterBar);

                //  Required for Define Conditions input
                this._oReserveVH.setRangeKeyFields([
                    {
                        label: "Reservation",
                        key: "Reservation",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }
                ]);

                // Set Model
                this._oReserveVH.setModel(this.getView().getModel());

                // Table Setup
                this._oReserveVH.getTableAsync().then(function (oTable) {

                    oTable.addColumn(new sap.ui.table.Column({
                        label: new sap.m.Label({ text: "Reservation" }),
                        template: new sap.m.Text({ text: "{Reservation}" })
                    }));

                    oTable.setSelectionMode("MultiToggle");

                    this._oReserveVH.update();

                }.bind(this));
            }

            // Initial Load (no filters)
            this._loadMaintOrdersReserve([]);

            this._oReserveVH.open();
        },


        /* Load Data with Multi Filters                         */

        _loadMaintOrdersReserve: function (aTokenFilters) {

            var oModel = this.getView().getModel();

            var aFilters = [];

            // Apply OR filter for tokens
            if (aTokenFilters && aTokenFilters.length > 0) {
                aFilters.push(new sap.ui.model.Filter({
                    filters: aTokenFilters,
                    and: false
                }));
            }

            oModel.read("/YY1_FLGTRK_Tracking_API", {

                filters: aFilters,

                urlParameters: {
                    $select: "Reservation",
                    $top: 10000
                },

                success: function (oData) {

                    //  Remove duplicates
                    var oUniqueMap = new Map();

                    oData.results.forEach(function (oItem) {
                        if (!oUniqueMap.has(oItem.Reservation)) {
                            oUniqueMap.set(oItem.Reservation, oItem);
                        }
                    });

                    var aUniqueData = Array.from(oUniqueMap.values());

                    var oReserveVHModel = new sap.ui.model.json.JSONModel(aUniqueData);

                    this._oReserveVH.getTableAsync().then(function (oTable) {
                        oTable.setModel(oReserveVHModel);
                        oTable.bindRows("/");
                    });

                }.bind(this),

                error: function () {
                    sap.m.MessageToast.show("Failed to load Reservation");
                }
            });
        },
        //Delivery

        // onDeliveryVHRqst: function () {

        //     if (!this._oDeliveryVH) {

        //         // Create the ValueHelpDialog
        //         this._oDeliveryVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //             title: "Select Delivery",
        //             supportRanges: true,        // Enables "Define Conditions" tab
        //             supportRangesOnly: true,    // Only show Define Conditions
        //             key: "Delivery",
        //             ok: function (oEvent) {

        //                 var aTokens = oEvent.getParameter("tokens");
        //                 var oMultiInput = this.byId("idFltrDelivery");

        //                 oMultiInput.removeAllTokens();

        //                 aTokens.forEach(function (oToken) {
        //                     var oRangeData = oToken.data("range");

        //                     if (oRangeData) {
        //                         // Range token
        //                         var sValue = oRangeData.value1;

        //                         if (oRangeData.operation === "Contains") {
        //                             sValue = "*" + sValue + "*";
        //                         }

        //                         oMultiInput.addToken(new sap.m.Token({
        //                             key: sValue,
        //                             text: sValue
        //                         }));
        //                     } else {
        //                         // Normal selection token
        //                         var sKey = oToken.getKey();
        //                         if (sKey) {
        //                             oMultiInput.addToken(new sap.m.Token({
        //                                 key: sKey,
        //                                 text: sKey
        //                             }));
        //                         }
        //                     }

        //                 });

        //                 this._oDeliveryVH.close();

        //             }.bind(this),

        //             cancel: function () {
        //                 this._oDeliveryVH.close();
        //             }.bind(this)
        //         });

        //         // Add to view
        //         this.getView().addDependent(this._oDeliveryVH);

        //         // Configure range key fields
        //         this._oDeliveryVH.setRangeKeyFields([
        //             {
        //                 label: "Delivery",
        //                 key: "DeliveryNumber",
        //                 type: "string",
        //                 typeInstance: new sap.ui.model.type.String()
        //             }
        //         ]);

        //     }

        //     // Open the ValueHelpDialog
        //     this._oDeliveryVH.open();
        // },

        // onPOVHRqst: function () {

        //     if (!this._oPOVH) {

        //         // Create the ValueHelpDialog
        //         this._oPOVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //             title: "Select Purchase Order",
        //             supportRanges: true,        // Enables "Define Conditions" tab
        //             supportRangesOnly: true,    // Only show Define Conditions
        //             key: "PurchaseOrder",
        //             ok: function (oEvent) {

        //                 var aTokens = oEvent.getParameter("tokens");
        //                 var oMultiInput = this.byId("idFltrPO");

        //                 oMultiInput.removeAllTokens();

        //                 aTokens.forEach(function (oToken) {
        //                     var oRangeData = oToken.data("range");

        //                     if (oRangeData) {
        //                         // Range token
        //                         var sValue = oRangeData.value1;

        //                         if (oRangeData.operation === "Contains") {
        //                             sValue = "*" + sValue + "*";
        //                         }

        //                         oMultiInput.addToken(new sap.m.Token({
        //                             key: sValue,
        //                             text: sValue
        //                         }));
        //                     } else {
        //                         // Normal selection token
        //                         var sKey = oToken.getKey();
        //                         if (sKey) {
        //                             oMultiInput.addToken(new sap.m.Token({
        //                                 key: sKey,
        //                                 text: sKey
        //                             }));
        //                         }
        //                     }

        //                 });

        //                 this._oPOVH.close();

        //             }.bind(this),

        //             cancel: function () {
        //                 this._oPOVH.close();
        //             }.bind(this)
        //         });

        //         // Add to view
        //         this.getView().addDependent(this._oPOVH);

        //         // Configure range key fields
        //         this._oPOVH.setRangeKeyFields([
        //             {
        //                 label: "Purchase Order",
        //                 key: "PurchaseOrder",
        //                 type: "string",
        //                 typeInstance: new sap.ui.model.type.String()
        //             }
        //         ]);

        //     }
        //     // Open the ValueHelpDialog
        //     this._oPOVH.open();
        // },

        //STO
        // onSTOVHRqst: function () {

        //     if (!this._oSTOVH) {

        //         // Create the ValueHelpDialog
        //         this._oSTOVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //             title: "Select STO",
        //             supportRanges: true,        // Enables "Define Conditions" tab
        //             supportRangesOnly: true,    // Only show Define Conditions
        //             key: "STO",
        //             ok: function (oEvent) {

        //                 var aTokens = oEvent.getParameter("tokens");
        //                 var oMultiInput = this.byId("idFltrSTO");

        //                 oMultiInput.removeAllTokens();

        //                 aTokens.forEach(function (oToken) {
        //                     var oRangeData = oToken.data("range");

        //                     if (oRangeData) {
        //                         // Range token
        //                         var sValue = oRangeData.value1;

        //                         if (oRangeData.operation === "Contains") {
        //                             sValue = "*" + sValue + "*";
        //                         }

        //                         oMultiInput.addToken(new sap.m.Token({
        //                             key: sValue,
        //                             text: sValue
        //                         }));
        //                     } else {
        //                         // Normal selection token
        //                         var sKey = oToken.getKey();
        //                         if (sKey) {
        //                             oMultiInput.addToken(new sap.m.Token({
        //                                 key: sKey,
        //                                 text: sKey
        //                             }));
        //                         }
        //                     }

        //                 });

        //                 this._oSTOVH.close();

        //             }.bind(this),

        //             cancel: function () {
        //                 this._oSTOVH.close();
        //             }.bind(this)
        //         });

        //         // Add to view
        //         this.getView().addDependent(this._oPOVH);

        //         // Configure range key fields
        //         this._oSTOVH.setRangeKeyFields([
        //             {
        //                 label: "STO",
        //                 key: "STO",
        //                 type: "string",
        //                 typeInstance: new sap.ui.model.type.String()
        //             }
        //         ]);

        //     }
        //     // Open the ValueHelpDialog
        //     this._oSTOVH.open();
        // },
        // //PurchaseReq
        // onPRVHRqst: function () {

        //     if (!this._oPRVH) {

        //         // Create the ValueHelpDialog
        //         this._oPRVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //             title: "Select Purchase Requisition",
        //             supportRanges: true,        // Enables "Define Conditions" tab
        //             supportRangesOnly: true,    // Only show Define Conditions
        //             key: "PurchaseRequisition",
        //             ok: function (oEvent) {

        //                 var aTokens = oEvent.getParameter("tokens");
        //                 var oMultiInput = this.byId("idFltrPurReq");

        //                 oMultiInput.removeAllTokens();

        //                 aTokens.forEach(function (oToken) {
        //                     var oRangeData = oToken.data("range");

        //                     if (oRangeData) {
        //                         // Range token
        //                         var sValue = oRangeData.value1;

        //                         if (oRangeData.operation === "Contains") {
        //                             sValue = "*" + sValue + "*";
        //                         }

        //                         oMultiInput.addToken(new sap.m.Token({
        //                             key: sValue,
        //                             text: sValue
        //                         }));
        //                     } else {
        //                         // Normal selection token
        //                         var sKey = oToken.getKey();
        //                         if (sKey) {
        //                             oMultiInput.addToken(new sap.m.Token({
        //                                 key: sKey,
        //                                 text: sKey
        //                             }));
        //                         }
        //                     }

        //                 });

        //                 this._oPRVH.close();

        //             }.bind(this),

        //             cancel: function () {
        //                 this._oPRVH.close();
        //             }.bind(this)
        //         });

        //         // Add to view
        //         this.getView().addDependent(this._oPRVH);

        //         // Configure range key fields
        //         this._oPRVH.setRangeKeyFields([
        //             {
        //                 label: "Purchase Requisition",
        //                 key: "PurchaseRequisition",
        //                 type: "string",
        //                 typeInstance: new sap.ui.model.type.String()
        //             }
        //         ]);

        //     }
        //     // Open the ValueHelpDialog
        //     this._oPRVH.open();
        // },

        //Plant

        onPlantVHRqst: function () {

            if (!this._oPlantVH) {

                this._oPlantVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Plant",
                    supportMultiselect: true,
                    key: "Plant",
                    descriptionKey: "PlantName",

                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrPlant");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {

                            var oRangeData = oToken.data("range");

                            //  Define Conditions (Range)
                            if (oRangeData) {

                                var sValue = oRangeData.value1;

                                //  handle operators
                                if (oRangeData.operation === "Contains") {
                                    sValue = "*" + sValue + "*";
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                            }

                            //   Normal Selection
                            else {
                                var sKey = oToken.getKey();

                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });


                        this._oPlantVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oPlantVH.close();
                    }.bind(this)
                });

                this.getView().addDependent(this._oPlantVH);

                // Filter Input
                var oFilterInput = new sap.m.Input({
                    placeholder: "Search Plant"
                });

                //  Filter Bar
                var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
                    advancedMode: true,
                    filterBarExpanded: true,

                    search: function () {
                        var sValue = oFilterInput.getValue();
                        this._loadMaintOrdersPlant(sValue);
                    }.bind(this)
                });

                // Filter Field
                oFilterBar.addFilterItem(new sap.ui.comp.filterbar.FilterItem({
                    name: "Plant",
                    label: "Plant",
                    control: oFilterInput
                }));

                this._oPlantVH.setFilterBar(oFilterBar);

                // Enable "Define Conditions"
                // this._oMaintVH.setSupportRanges(true);
                // this._oMaintVH.setSupportRangesOnly(false);

                // FIX: Required for enabling input field
                this._oPlantVH.setRangeKeyFields([
                    {
                        label: "Plant",
                        key: "Plant",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    },
                    {
                        label: "Description",
                        key: "PlantName",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }

                ]);

                // Set Model
                this._oPlantVH.setModel(this.getView().getModel());

                // Prepare Table
                this._oPlantVH.getTableAsync().then(function (oTable) {

                    // Column: Maintenance Order
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new sap.m.Label({ text: "Plant" }),
                        template: new sap.m.Text({ text: "{Plant}" })
                    }));

                    // Column: Description
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new sap.m.Label({ text: "Description" }),
                        template: new sap.m.Text({
                            text: {
                                path: "PlantName",
                                formatter: function (sValue) {
                                    if (sValue) {
                                        return sValue.split("(")[0].trim(); // remove anything in parentheses
                                    }
                                    return sValue;
                                }
                            }
                        })
                    }));

                    oTable.setSelectionMode("MultiToggle");

                    this._oPlantVH.update();

                }.bind(this));
            }

            //  Initial Load
            this._loadMaintOrdersPlant("");

            this._oPlantVH.open();
        },

        _loadMaintOrdersPlant: function (sValue) {

            var oModel = this.getView().getModel("YY1_FLGTRK_TRACKPR_API_CDS");
            var aFilters = [];

            // Search filter
            if (sValue) {
                aFilters.push(new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.Contains, sValue),

                    ],
                    and: false
                }));
            }

            oModel.read("/YY1_FLGTRK_TrackPR_API", {

                filters: aFilters,

                urlParameters: {
                    $select: "Plant,PlantName",
                    $top: 10000
                },

                success: function (oData) {

                    // Remove duplicates
                    var oUniqueMap = new Map();

                    oData.results.forEach(function (oItem) {
                        if (!oUniqueMap.has(oItem.Plant)) {
                            oUniqueMap.set(oItem.Plant, oItem);
                        }
                    });

                    var aUniqueData = Array.from(oUniqueMap.values());

                    var oPlantVHModel = new sap.ui.model.json.JSONModel(aUniqueData);

                    this._oPlantVH.getTableAsync().then(function (oTable) {
                        oTable.setModel(oPlantVHModel);
                        oTable.bindRows("/");
                    });

                }.bind(this),

                error: function () {
                    sap.m.MessageToast.show("Failed to load Plant");
                }
            });
        },


        //Material
        onMaterialVHRqst: function () {

            if (!this._oMaterialVH) {

                this._oMaterialVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Material",
                    supportMultiselect: true,
                    key: "Material",
                    supportRanges: true,          // Enables "Define Conditions"
                    supportRangesOnly: false,
                    // descriptionKey: "ProductName",

                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrMaterial");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {

                            var oRangeData = oToken.data("range");

                            //  Define Conditions (Range)
                            if (oRangeData) {

                                var sValue = oRangeData.value1;
                                if (oRangeData.value2) {
                                    sValue = oRangeData.value1 + "..." + oRangeData.value2;
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                                // store full range (operation, value1, value2, exclude)
                                oMultiInput.data("range", oRangeData);
                            }

                            //   Normal Selection
                            else {
                                var sKey = oToken.getKey();

                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });


                        this._oMaterialVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oMaterialVH.close();
                    }.bind(this)
                });

                this.getView().addDependent(this._oMaterialVH);

                // Filter Input
                var oFilterInput = new sap.m.Input({
                    placeholder: "Search Material"
                });

                //  Filter Bar
                var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
                    advancedMode: true,
                    filterBarExpanded: true,

                    search: function () {
                        var sValue = oFilterInput.getValue();
                        this._loadMaintOrdersMaterial(sValue);
                    }.bind(this)
                });

                // Filter Field
                oFilterBar.addFilterItem(new sap.ui.comp.filterbar.FilterItem({
                    name: "Material",
                    label: "Material",
                    control: oFilterInput
                }));

                this._oMaterialVH.setFilterBar(oFilterBar);

                // Enable "Define Conditions"
                //this._oMaintVH.setSupportRanges(true);
                //this._oMaintVH.setSupportRangesOnly(false);

                // FIX: Required for enabling input field - Define Conditions
                this._oMaterialVH.setRangeKeyFields([
                    {
                        label: "Material",
                        key: "Material",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }

                    // {
                    //     label: "Material Description",
                    //     key: "ProductName",
                    //     type: "string",
                    //     typeInstance: new sap.ui.model.type.String()
                    // }

                ]);

                // Set Model
                this._oMaterialVH.setModel(this.getView().getModel());

                // Prepare Table
                this._oMaterialVH.getTableAsync().then(function (oTable) {

                    // Column: Maintenance Order
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new sap.m.Label({ text: "Material" }),
                        template: new sap.m.Text({ text: "{Material}" })
                    }));

                    // Column: Description
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new sap.m.Label({ text: "Description" }),
                        template: new sap.m.Text({ text: "{ProductName}" })
                    }));

                    oTable.setSelectionMode("MultiToggle");

                    this._oMaterialVH.update();

                }.bind(this));
            }

            //  Initial Load
            this._loadMaintOrdersMaterial("");

            this._oMaterialVH.open();
        },

        _loadMaintOrdersMaterial: function (sValue) {

            var oModel = this.getView().getModel();
            var aFilters = [];

            // Search filter
            if (sValue) {
                aFilters.push(new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("Material", sap.ui.model.FilterOperator.Contains, sValue),

                    ],
                    and: false
                }));
            }

            oModel.read("/YY1_FLGTRK_Tracking_API", {

                filters: aFilters,

                urlParameters: {
                    $select: "Material,ProductName",
                    $top: 10000
                },

                success: function (oData) {

                    //  Declare FIRST
                    var oUniqueMap = new Map();

                    oData.results.forEach(function (oItem) {

                        // Skip empty Material
                        if (!oItem.Material || oItem.Material.trim() === "") {
                            return;
                        }

                        //  Remove duplicates
                        if (!oUniqueMap.has(oItem.Material)) {
                            oUniqueMap.set(oItem.Material, oItem);
                        }

                    });

                    var aUniqueData = Array.from(oUniqueMap.values());

                    var oMaterialVHModel = new sap.ui.model.json.JSONModel(aUniqueData);

                    this._oMaterialVH.getTableAsync().then(function (oTable) {
                        oTable.setModel(oMaterialVHModel);
                        oTable.bindRows("/");
                    });

                }.bind(this),

                error: function () {
                    sap.m.MessageToast.show("Failed to load Material");
                }
            });
        }







    });
});