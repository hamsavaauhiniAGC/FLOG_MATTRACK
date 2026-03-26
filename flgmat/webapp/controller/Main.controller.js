sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Token",
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageToast",
    "sap/ui/comp/smartvariants/PersonalizableInfo"

], (Controller,
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
            //this.oFilterBar.setSmartVariant(this.oSmartVariantManagement);
            // Attach FilterBar personalizable info
            var oFilterPersInfo = new PersonalizableInfo({
                type: "filterBar",
                keyName: "MaterialTrackingKey",
                control: this.oFilterBar
            });
            this.oSmartVariantManagement.addPersonalizableControl(oFilterPersInfo);

            // Attach Table personalizable info
            // var attachTablePers = function () {
            //     var aColumns = this.oTable.getColumns();
            //     var oTablePersInfo = new PersonalizableInfo({
            //         type: "table",
            //         keyName: "ColumnVisibilityKey",
            //         control: this.oTable,
            //         columnKeys: aColumns.map(c => c.getId())
            //     });
            //     this.oSmartVariantManagement.addPersonalizableControl(oTablePersInfo);

            //     //  Initialize variant management here
            //     this.oSmartVariantManagement.initialise(function () {
            //         console.log("Variant initialized");
            //     }, this.oFilterBar);
            // }.bind(this);

            // If table already has rows (or use attachEventOnce)
            // if (this.oTable.getColumns().length > 0) {
            //     attachTablePers();
            // } else {
            //     this.oTable.attachEventOnce("updateFinished", attachTablePers);
            // }

            this.oSmartVariantManagement.initialise(function () {
                console.log("Variant initialized");
            }, this.oFilterBar);
            // Register filter hooks
            this.oFilterBar.registerFetchData(this._fetchData.bind(this));
            this.oFilterBar.registerApplyData(this._applyData.bind(this));

        },

        // Get current values from all MultiInput fields as array of keys
        _fetchData: function () {
            return this.oFilterBar.getFilterGroupItems().map(function (oItem) {
                var oControl = oItem.getControl();
                var aTokens = oControl.getTokens ? oControl.getTokens() : [];
                var aKeys = aTokens.map(function (t) { return t.getKey(); });
                return {
                    groupName: oItem.getGroupName(),
                    fieldName: oItem.getName(),
                    fieldData: aKeys
                };
            });
        },
        // Apply saved variant to MultiInput controls
        _applyData: function (aData) {
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
            }, this);
        },
        onSelectionChange: function (oEvent) {
            // Mark variant as modified whenever user changes filter
            this.oSmartVariantManagement.currentVariantSetModified(true);
            this.oFilterBar.fireFilterChange(oEvent);
        },
        // Trigger search after a variant is applied
        onAfterVariantLoad: function () {
            //this.onFltrSearch();
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
        },
        //UCC FILTERS

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
                            ) {
                                bSkipUCC = true;
                            }

                            // MultiFilter
                            if (oFilter.aFilters) {
                                oFilter.aFilters.forEach(function (subFilter) {
                                    if (subFilter.sPath === "Plant" || subFilter.sPath === "Material"
                                        || subFilter.sPath === "RequirementDate" || subFilter.sPath === "PurchaseRequisition"
                                        || subFilter.sPath === "PurchaseOrder" || subFilter.sPath === "STO" || subFilter.sPath === "Reservation"
                                    ) {
                                        bSkipUCC = true;
                                    }
                                });
                            }

                        });

                        //UCC PROCESSING 

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

                                            oNEWUCC.BinLocation = oMatchedUCC.BinLocation || "";
                                            oNEWUCC.DropLocation = oMatchedUCC.DropLocation || "";
                                            oNEWUCC.OffShoreBin = oMatchedUCC.OffShoreBin || "";
                                            oNEWUCC.OldShipItem = oMatchedUCC.OldShipItem || "";
                                            oNEWUCC.RentalInfo = oMatchedUCC.RentalInfo || "";
                                            oNEWUCC.Supplier_WOREF = oMatchedUCC.Supplier || "";
                                            oNEWUCC.RefDelivery = oMatchedUCC.RetDel || "";


                                            aUCCMergedData.push(oNEWUCC);

                                        });

                                    }

                                });

                                aFinalData = aUCCMergedData;
                            }

                            else {
                                oUCCMap.forEach(function (aUCCList, sOrder) {

                                    aUCCList.forEach(function (oMatchedUCC) {

                                        var oNEWUCC = {};

                                        oNEWUCC.MaintenanceOrder = oMatchedUCC.MaintOrder;
                                        oNEWUCC.MaintenanceOrderDesc = "";
                                        oNEWUCC.MaintenanceOrderType = "";
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

                                        oNEWUCC.BinLocation = oMatchedUCC.BinLocation || "";
                                        oNEWUCC.DropLocation = oMatchedUCC.DropLocation || "";
                                        oNEWUCC.OffShoreBin = oMatchedUCC.OffShoreBin || "";
                                        oNEWUCC.OldShipItem = oMatchedUCC.OldShipItem || "";
                                        oNEWUCC.RentalInfo = oMatchedUCC.RentalInfo || "";
                                        oNEWUCC.Supplier_WOREF = oMatchedUCC.Supplier || "";
                                        oNEWUCC.RefDelivery = oMatchedUCC.RetDel || "";

                                        aUCCMergedData.push(oNEWUCC);

                                    });

                                });

                                aFinalData = aUCCMergedData;
                            }
                        }

                        //new - Container API
                        var aPromises = aFinalData.map(function (oItem) {
                            if (oItem.DeliveryNumber) { // Ensure you use the right property name
                                return this._getContainerDetails(oItem);
                            }
                            return Promise.resolve();
                        }.bind(this));
                        Promise.all(aPromises).then(function () {


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
                                oItem.DeliveryItem = oItem.DeliveryItem?.padStart(6, '0');
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

                oModel.read("/YY1_FLG_WOREF_DELTYPE_API", {

                    filters: [
                        new sap.ui.model.Filter({
                            filters: aFilters,
                            and: true
                        })
                    ],

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
            try {
                const aContexts = await oListBinding.requestContexts();
                if (aContexts && aContexts.length > 0) {
                    const aData = aContexts.map(oCtx => oCtx.getObject());
                    oItem.ContainerID = aData.map(c => c.FldLogsContainerID).join(", ");
                    oItem.ContainerStatus = aData[0].FldLogsContainerStatus;
                    const sContainerUUID = aData[0].FldLogsContainerUnitUUID;
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
            const oModel = this.getOwnerComponent().getModel("shipmentcontainerunit");
            const sPath = "/ShipmentContainer(" + sContainerUUID + ")/_ShptStgeAssgmt";
            const oListBinding = oModel.bindList(sPath);
            try {
                const aContexts = await oListBinding.requestContexts();
                if (aContexts && aContexts.length > 0) {
                    const oVoyageData = aContexts[0].getObject();
                    oItem.VoyageNumber = oVoyageData.FldLogsShptVoyageNumber;
                    oItem.VoyageUUID = oVoyageData.FldLogsShptVoyageUUID;
                    oItem.VehicleName = oVoyageData.FldLogsShptVoyageVehicleName;
                    oItem.SourceStage = oVoyageData.FldLogsVoyageSrceStage;
                    oItem.DestStage = oVoyageData.FldLogsVoyageDestStage;
                    oItem.VoyageStatus = oVoyageData.FldLogsShptVoyageTypeCode
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

            // var oMultiInputMO = this.byId("idFltrMo");
            var oMultiInputMO = this.getView().byId("idFltrMo")

            // Convert typed value into token 
            this._addTokenFromValue(oMultiInputMO);

            var aMoTokens = oMultiInputMO.getTokens();
            var aMoFilters = [];

            aMoTokens.forEach(function (oToken) {
                aMoFilters.push(
                    new sap.ui.model.Filter(
                        "MaintenanceOrder",
                        sap.ui.model.FilterOperator.EQ,
                        oToken.getKey()
                    )
                );
            });

            if (aMoFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aMoFilters,
                        and: false   // OR condition
                    })
                );
            }
            /* Maintenance Order Desc  */

            var oMultiInputDesc = this.byId("idFltrMODesc");

            this._addTokenFromValue(oMultiInputDesc);

            var aDescTokens = oMultiInputDesc.getTokens();
            var aDescFilters = [];

            aDescTokens.forEach(function (oToken) {
                aDescFilters.push(
                    new sap.ui.model.Filter(
                        "MaintenanceOrderDesc",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDescFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDescFilters,
                        and: false
                    })
                );
            }
            /* Reservation  */

            var oMultiInputReserve = this.byId("idFltrReserve");
            this._addTokenFromValue(oMultiInputReserve);
            var aReserveTokens = oMultiInputReserve.getTokens();
            var aReserveFilters = [];
            aReserveTokens.forEach(function (oToken) {

                var sValue = oToken.getKey() || "";

                //  Check if value contains *
                var bHasWildcard = sValue.includes("*");

                //  Remove * only if present
                var sCleanValue = bHasWildcard ? sValue.replace(/\*/g, "") : sValue;

                var sFinalValue;

                // If already fully padded (10 digits), keep as-is
                if (/^\d{10}$/.test(sCleanValue)) {
                    sFinalValue = sCleanValue;
                } else {
                    // Otherwise, pad to 10 digits
                    sFinalValue = sCleanValue.padStart(10, "0");
                }

                // Create filter for this token
                aReserveFilters.push(
                    new sap.ui.model.Filter(
                        "Reservation",
                        sap.ui.model.FilterOperator.EQ,
                        sFinalValue
                    )
                );

            });

            //  Combine token filters into one OR filter
            if (aReserveFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aReserveFilters,
                        and: false // OR
                    })
                );
            }
            /* Plant */

            var oMultiInputPlant = this.byId("idFltrPlant");

            this._addTokenFromValue(oMultiInputPlant);

            var aPlantTokens = oMultiInputPlant.getTokens();
            var aPlantFilters = [];

            aPlantTokens.forEach(function (oToken) {
                aPlantFilters.push(
                    new sap.ui.model.Filter(
                        "Plant",
                        sap.ui.model.FilterOperator.EQ,
                        oToken.getKey()
                    )
                );
            });

            if (aPlantFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aPlantFilters,
                        and: false
                    })
                );
            }
            /* MATERIAL  */

            var oMultiInputMaterial = this.byId("idFltrMaterial");

            this._addTokenFromValue(oMultiInputMaterial);

            var aMaterialTokens = oMultiInputMaterial.getTokens();
            var aMaterialFilters = [];

            aMaterialTokens.forEach(function (oToken) {
                aMaterialFilters.push(
                    new sap.ui.model.Filter(
                        "Material",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aMaterialFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aMaterialFilters,
                        and: false
                    })
                );
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
            var aSupplyPlantPOFilters = [];

            aSupplyPlantPOTokens.forEach(function (oToken) {
                aSupplyPlantPOFilters.push(
                    new sap.ui.model.Filter(
                        "SupplyingPlant_PO",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aSupplyPlantPOFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aSupplyPlantPOFilters,
                        and: false
                    })
                );
            }
            //Supply Plant STO
            var oMultiInputSupplyPlantSTO = this.byId("idFltrSupplyPlantSTO");

            this._addTokenFromValue(oMultiInputSupplyPlantSTO);

            var aSupplyPlantSTOTokens = oMultiInputSupplyPlantSTO.getTokens();
            var aSupplyPlantSTOFilters = [];

            aSupplyPlantSTOTokens.forEach(function (oToken) {
                aSupplyPlantSTOFilters.push(
                    new sap.ui.model.Filter(
                        "SupplyingPlant_STO",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aSupplyPlantSTOFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aSupplyPlantSTOFilters,
                        and: false
                    })
                );
            }

            //MO Type
            var oMultiInputMOType = this.byId("idFltrMOType");

            this._addTokenFromValue(oMultiInputMOType);

            var aMOTypeTokens = oMultiInputMOType.getTokens();
            var aMOTypeFilters = [];

            aMOTypeTokens.forEach(function (oToken) {
                aMOTypeFilters.push(
                    new sap.ui.model.Filter(
                        "MaintenanceOrderType",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aMOTypeFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aMOTypeFilters,
                        and: false
                    })
                );
            }
            //Basic Start Date
            var oMultiInputbasicStrtDt = this.byId("idFltrStrtdt");

            this._addTokenFromValue(oMultiInputbasicStrtDt);

            var abasicStrtDtTokens = oMultiInputbasicStrtDt.getTokens();
            var abasicStrtDtFilters = [];

            abasicStrtDtTokens.forEach(function (oToken) {
                abasicStrtDtFilters.push(
                    new sap.ui.model.Filter(
                        "MaintOrdBasicStartDate",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (abasicStrtDtFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: abasicStrtDtFilters,
                        and: false
                    })
                );
            }
            //Basic End Date
            var oMultiInputEndDt = this.byId("idFltrEndDt");

            this._addTokenFromValue(oMultiInputEndDt);

            var aEndDtTokens = oMultiInputEndDt.getTokens();
            var aEndDtFilters = [];

            aEndDtTokens.forEach(function (oToken) {
                aEndDtFilters.push(
                    new sap.ui.model.Filter(
                        "MaintOrdBasicEndDate",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aEndDtFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aEndDtFilters,
                        and: false
                    })
                );
            }
            //Operation
            var oMultiInputOperation = this.byId("idFltrOpr");

            this._addTokenFromValue(oMultiInputOperation);

            var aOperationTokens = oMultiInputOperation.getTokens();
            var aOperationFilters = [];

            aOperationTokens.forEach(function (oToken) {
                aOperationFilters.push(
                    new sap.ui.model.Filter(
                        "MaintenanceOrderOperation",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aOperationFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aOperationFilters,
                        and: false
                    })
                );
            }
            //Reservation Item
            var oMultiInputResItemNo = this.byId("idFltrResItemNo");

            this._addTokenFromValue(oMultiInputResItemNo);

            var aResItemNoTokens = oMultiInputResItemNo.getTokens();
            var aResItemNoFilters = [];

            aResItemNoTokens.forEach(function (oToken) {
                aResItemNoFilters.push(
                    new sap.ui.model.Filter(
                        "ReservationItem",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aResItemNoFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aResItemNoFilters,
                        and: false
                    })
                );
            }
            //Storage loc
            var oMultiInputSloc = this.byId("idFltrSloc");

            this._addTokenFromValue(oMultiInputSloc);

            var aSlocTokens = oMultiInputSloc.getTokens();
            var aSlocFilters = [];

            aSlocTokens.forEach(function (oToken) {
                aSlocFilters.push(
                    new sap.ui.model.Filter(
                        "StorageLocation",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aSlocFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aSlocFilters,
                        and: false
                    })
                );
            }
            //Requestor
            var oMultiInputRequestor = this.byId("idFltrRequestor");

            this._addTokenFromValue(oMultiInputRequestor);

            var aRequestorTokens = oMultiInputRequestor.getTokens();
            var aRequestorFilters = [];

            aRequestorTokens.forEach(function (oToken) {
                aRequestorFilters.push(
                    new sap.ui.model.Filter(
                        "MaintOrdOpCompRequisitioner",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aRequestorFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aRequestorFilters,
                        and: false
                    })
                );
            }
            // STO
            var oMultiInputSTO = this.byId("idFltrSTO");

            this._addTokenFromValue(oMultiInputSTO);

            var aSTOTokens = oMultiInputSTO.getTokens();
            var aSTOFilters = [];

            aSTOTokens.forEach(function (oToken) {
                var sValue = oToken.getKey() || "";
                var bHasWildcard = sValue.includes("*");
                var sFinalValue = bHasWildcard ? sValue.replace(/\*/g, "") : sValue;
                aSTOFilters.push(
                    new sap.ui.model.Filter(
                        "STO",
                        sap.ui.model.FilterOperator.Contains,
                        sFinalValue
                    )
                );
            });

            if (aSTOFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aSTOFilters,
                        and: false
                    })
                );
            }
            //PO
            var oMultiInputPO = this.byId("idFltrPO");

            this._addTokenFromValue(oMultiInputPO);

            var aPOTokens = oMultiInputPO.getTokens();
            var aPOFilters = [];

            aPOTokens.forEach(function (oToken) {
                var sValue = oToken.getKey() || "";
                var bHasWildcard = sValue.includes("*");
                var sFinalValue = bHasWildcard ? sValue.replace(/\*/g, "") : sValue;
                aPOFilters.push(
                    new sap.ui.model.Filter(
                        "PurchaseOrder",
                        sap.ui.model.FilterOperator.Contains,
                        sFinalValue
                    )
                );
            });
             
            if (aPOFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aPOFilters,
                        and: false
                    })
                );
            }
            //IssueSLoc PO
            var oMultiInputIssueSLocPO = this.byId("idFltrIssueSLoc");

            this._addTokenFromValue(oMultiInputIssueSLocPO);

            var aIssueSLocPOTokens = oMultiInputIssueSLocPO.getTokens();
            var aIssueSLocPOFilters = [];

            aIssueSLocPOTokens.forEach(function (oToken) {
                aIssueSLocPOFilters.push(
                    new sap.ui.model.Filter(
                        "IssuingStorageLocation_PO",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aIssueSLocPOFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aIssueSLocPOFilters,
                        and: false
                    })
                );
            }
            //Supplier PO
            var oMultiInputSupplier = this.byId("idFltrSupplier");

            this._addTokenFromValue(oMultiInputSupplier);

            var aSupplierTokens = oMultiInputSupplier.getTokens();
            var aSupplierFilters = [];

            aSupplierTokens.forEach(function (oToken) {
                aSupplierFilters.push(
                    new sap.ui.model.Filter(
                        "Supplier_PO",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aSupplierFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aSupplierFilters,
                        and: false
                    })
                );
            }
            //DeliveryDate PO
            var oMultiInputDeliveryDate = this.byId("idFltrDeliveryDate");

            this._addTokenFromValue(oMultiInputDeliveryDate);

            var aDeliveryDateTokens = oMultiInputDeliveryDate.getTokens();
            var aDeliveryDateFilters = [];

            aDeliveryDateTokens.forEach(function (oToken) {
                aDeliveryDateFilters.push(
                    new sap.ui.model.Filter(
                        "YY1_DELIVERYDATE_PDI_PO",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDeliveryDateFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDeliveryDateFilters,
                        and: false
                    })
                );
            }
            //DeliveryCrtDate
            var oMultiInputDeliveryCrtDate = this.byId("idFltrDeliveryCrtDate");

            this._addTokenFromValue(oMultiInputDeliveryCrtDate);

            var aDeliveryCrtDateTokens = oMultiInputDeliveryCrtDate.getTokens();
            var aDeliveryCrtDateFilters = [];

            aDeliveryCrtDateTokens.forEach(function (oToken) {
                aDeliveryCrtDateFilters.push(
                    new sap.ui.model.Filter(
                        "DeliveryCreationDate",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDeliveryCrtDateFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDeliveryCrtDateFilters,
                        and: false
                    })
                );
            }
            //Delivery
            var oMultiInputDelivery = this.byId("idFltrDelivery");

            this._addTokenFromValue(oMultiInputDelivery);

            var aDeliveryTokens = oMultiInputDelivery.getTokens();
            var aDeliveryFilters = [];

            aDeliveryTokens.forEach(function (oToken) {

                var sValue = oToken.getKey() || "";
                var bHasWildcard = sValue.includes("*");
                var sFinalValue = bHasWildcard ? sValue.replace(/\*/g, "") : sValue;
                sFinalValue = sFinalValue?.padStart(10, '0');
                aDeliveryFilters.push(
                    new sap.ui.model.Filter(
                        "DeliveryNumber",
                        sap.ui.model.FilterOperator.EQ,
                        sFinalValue
                    )
                );
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

            //DeliveryPickingdate - Delivery
            var oMultiInputDeliveryPickingdate = this.byId("idFltrDeliveryPickingdate");

            this._addTokenFromValue(oMultiInputDeliveryPickingdate);

            var aDeliveryPickingdateTokens = oMultiInputDeliveryPickingdate.getTokens();
            var aDeliveryPickingdateFilters = [];

            aDeliveryPickingdateTokens.forEach(function (oToken) {
                aDeliveryPickingdateFilters.push(
                    new sap.ui.model.Filter(
                        "PickingDate_Deli",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDeliveryPickingdateFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDeliveryPickingdateFilters,
                        and: false
                    })
                );
            }
            //DeliverPickingstatus - Delivery
            var oMultiInputDeliverPickingstatus = this.byId("idFltrDeliverPickingstatus");

            this._addTokenFromValue(oMultiInputDeliverPickingstatus);

            var aDeliverPickingstatusTokens = oMultiInputDeliverPickingstatus.getTokens();
            var aDeliverPickingstatusFilters = [];

            aDeliverPickingstatusTokens.forEach(function (oToken) {
                aDeliverPickingstatusFilters.push(
                    new sap.ui.model.Filter(
                        "OvrlItmGeneralIncompletio_Deli",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDeliverPickingstatusFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDeliverPickingstatusFilters,
                        and: false
                    })
                );
            }
            //DelActGoodsIssuDate
            var oMultiInputDelActGoodsIssuDate = this.byId("idFltrDelActGoodsIssuDate");

            this._addTokenFromValue(oMultiInputDelActGoodsIssuDate);

            var aDelActGoodsIssuDateTokens = oMultiInputDelActGoodsIssuDate.getTokens();
            var aDelActGoodsIssuDateFilters = [];

            aDelActGoodsIssuDateTokens.forEach(function (oToken) {
                aDelActGoodsIssuDateFilters.push(
                    new sap.ui.model.Filter(
                        "ActualGoodsMovementDa_Deli",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDelActGoodsIssuDateFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDelActGoodsIssuDateFilters,
                        and: false
                    })
                );
            }
            //DeliPlndGoodsIssuDate
            var oMultiInputDeliPlndGoodsIssuDate = this.byId("idFltrDeliPlndGoodsIssuDate");

            this._addTokenFromValue(oMultiInputDeliPlndGoodsIssuDate);

            var aDeliPlndGoodsIssuDateTokens = oMultiInputDeliPlndGoodsIssuDate.getTokens();
            var aDeliPlndGoodsIssuDateFilters = [];

            aDeliPlndGoodsIssuDateTokens.forEach(function (oToken) {
                aDeliPlndGoodsIssuDateFilters.push(
                    new sap.ui.model.Filter(
                        "PlannedGoodsIssueDate_Deli",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDeliPlndGoodsIssuDateFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDeliPlndGoodsIssuDateFilters,
                        and: false
                    })
                );
            }
           
            //Deliveryfinalstatus
            var oMultiInputDeliveryfinalstatus = this.byId("idFltrDeliveryfinalstatus");

            this._addTokenFromValue(oMultiInputDeliveryfinalstatus);

            var aDeliveryfinalstatusTokens = oMultiInputDeliveryfinalstatus.getTokens();
            var aDeliveryfinalstatusFilters = [];

            aDeliveryfinalstatusTokens.forEach(function (oToken) {
                aDeliveryfinalstatusFilters.push(
                    new sap.ui.model.Filter(
                        "DeliveryFinalStatus",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aDeliveryfinalstatusFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aDeliveryfinalstatusFilters,
                        and: false
                    })
                );
            }
            //ReturnSTO
            var oMultiInputReturnSTO = this.byId("idFltrReturnSTO");

            this._addTokenFromValue(oMultiInputReturnSTO);

            var aReturnSTOTokens = oMultiInputReturnSTO.getTokens();
            var aReturnSTOFilters = [];

            aReturnSTOTokens.forEach(function (oToken) {
                aReturnSTOFilters.push(
                    new sap.ui.model.Filter(
                        "ReturnSTO",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aReturnSTOFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aReturnSTOFilters,
                        and: false
                    })
                );
            }
            //Purchase Req
            var oMultiInputPurReq = this.byId("idFltrPurReq");

            this._addTokenFromValue(oMultiInputPurReq);

            var aPurReqTokens = oMultiInputPurReq.getTokens();
            var aPurReqFilters = [];

            aPurReqTokens.forEach(function (oToken) {
                var sValue = oToken.getKey() || "";
                var bHasWildcard = sValue.includes("*");
                var sFinalValue = bHasWildcard ? sValue.replace(/\*/g, "") : sValue;
                aPurReqFilters.push(
                    new sap.ui.model.Filter(
                        "PurchaseRequisition",
                        sap.ui.model.FilterOperator.Contains,
                        sFinalValue
                    )
                );
            });

            if (aPurReqFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aPurReqFilters,
                        and: false
                    })
                );
            }
            //ReturnDeliverySupplier
            var oMultiInputReturnDeliverySupplier = this.byId("idFltrReturnDeliverySupplier");

            this._addTokenFromValue(oMultiInputReturnDeliverySupplier);

            var aReturnDeliverySupplierTokens = oMultiInputReturnDeliverySupplier.getTokens();
            var aReturnDeliverySupplierFilters = [];

            aReturnDeliverySupplierTokens.forEach(function (oToken) {
                aReturnDeliverySupplierFilters.push(
                    new sap.ui.model.Filter(
                        "Supplier_WOREF",
                        sap.ui.model.FilterOperator.Contains,
                        oToken.getKey()
                    )
                );
            });

            if (aReturnDeliverySupplierFilters.length > 0) {
                aMainFilters.push(
                    new sap.ui.model.Filter({
                        filters: aReturnDeliverySupplierFilters,
                        and: false
                    })
                );
            }



            /*  Apply Filters */
            if (!aMainFilters || aMainFilters.length === 0) {

                sap.m.MessageToast.show("Please select at least one filter");

                return; // stop loading
            }
            this._loadTrackdata(aMainFilters)
                .then(function (aData) {
                    console.log("Data loaded and deduplicated:", aData.length);
                })
                .catch(function (err) {

                    sap.m.MessageToast.show("Error loading data");
                });
            //oBinding.filter(aMainFilters);
        },


        /* HELPER FUNCTION – ADD TOKEN IF USER TYPED VALUE             */


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
                        aItems.forEach(function (oItem) {
                            var oColumn = this.getView().byId(oItem.columnKey);
                            if (oColumn) {
                                oColumn.setVisible(oItem.visible);
                            }
                        }.bind(this));

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
            var aCols = oTable.getColumns().map(function (oColumn) {
                return {
                    label: oColumn.getLabel().getText(),
                    property: oColumn.getTemplate().getBindingPath("text"),
                    type: "String"
                };
            });

            // Fetch table data
            var iLength = oBinding.getLength();
            var aContexts = await oBinding.getContexts(0, iLength);
            var aData = aContexts.map(function (oContext) {
                return oContext.getObject();
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

                    ok: function (oEvent) {

                        var oMultiInput = this.byId("idFltrMo");
                        oMultiInput.removeAllTokens();

                        oEvent.getParameter("tokens").forEach(function (oToken) {

                            oMultiInput.addToken(new sap.m.Token({
                                key: oToken.getKey(),
                                text: oToken.getKey()
                            }));

                        });

                        this._oMaintOrderVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oMaintOrderVH.close();
                    }.bind(this)
                });

                this.getView().addDependent(this._oMaintOrderVH);

                this._oMaintOrderVH.setFilterBar(this._createFilterBar(this._oMaintOrderVH));
                this._prepareTable(this._oMaintOrderVH);
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

                    ok: function (oEvent) {

                        var oMultiInput = this.byId("idFltrMODesc");
                        oMultiInput.removeAllTokens();

                        oEvent.getParameter("tokens").forEach(function (oToken) {

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
            }

            this._loadMaintOrders("", this._oMaintDescVH);
            this._oMaintDescVH.open();
        },
        _createFilterBar: function (oVH) {

            var oInput = new sap.m.Input({ placeholder: "Search Maintenance Order / Maximo Work Order" });

            var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
                advancedMode: true,
                filterBarExpanded: true,

                search: function () {
                    this._loadMaintOrders(oInput.getValue(), oVH);
                }.bind(this)
            });

            oFilterBar.addFilterItem(new sap.ui.comp.filterbar.FilterItem({
                name: "MaintOrder/WorkOrder",
                label: "MaintOrder / Maximo WorkOrder",
                control: oInput
            }));

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

        // onReservVHRqst: function () {

        //     if (!this._oReserveVH) {

        //         this._oReserveVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
        //             title: "Select Reservation",
        //             supportMultiselect: true,
        //             key: "Reservation",
        //             //descriptionKey: "MaintenanceOrderDesc",

        //             ok: function (oEvent) {

        //                 var aTokens = oEvent.getParameter("tokens");
        //                 var oMultiInput = this.byId("idFltrReserve");

        //                 oMultiInput.removeAllTokens();

        //                 aTokens.forEach(function (oToken) {

        //                     var oRangeData = oToken.data("range");

        //                     //  Define Conditions (Range)
        //                     if (oRangeData) {

        //                         var sValue = oRangeData.value1;

        //                         //  handle operators
        //                         if (oRangeData.operation === "Contains") {
        //                             sValue = "*" + sValue + "*";
        //                         }

        //                         oMultiInput.addToken(new sap.m.Token({
        //                             key: sValue,
        //                             text: sValue
        //                         }));
        //                     }

        //                     //   Normal Selection
        //                     else {
        //                         var sKey = oToken.getKey();

        //                         if (sKey) {
        //                             oMultiInput.addToken(new sap.m.Token({
        //                                 key: sKey,
        //                                 text: sKey
        //                             }));
        //                         }
        //                     }

        //                 });


        //                 this._oReserveVH.close();

        //             }.bind(this),

        //             cancel: function () {
        //                 this._oReserveVH.close();
        //             }.bind(this)
        //         });

        //         this.getView().addDependent(this._oReserveVH);

        //         // Filter Input
        //         var oFilterInput = new sap.m.Input({
        //             placeholder: "Search Reservation"
        //         });

        //         // Filter Bar
        //         var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
        //             advancedMode: true,
        //             filterBarExpanded: true,

        //             search: function () {
        //                 var sValue = oFilterInput.getValue();
        //                 this._loadMaintOrdersReserve(sValue);
        //             }.bind(this)
        //         });

        //         // Filter Field
        //         oFilterBar.addFilterItem(new sap.ui.comp.filterbar.FilterItem({
        //             name: "Reservation",
        //             label: "Reservation",
        //             control: oFilterInput
        //         }));

        //         this._oReserveVH.setFilterBar(oFilterBar);

        //         // Enable "Define Conditions"
        //         // this._oMaintVH.setSupportRanges(true);
        //         // this._oMaintVH.setSupportRangesOnly(false);

        //         // FIX: Required for enabling input field
        //         this._oReserveVH.setRangeKeyFields([
        //             {
        //                 label: "Reservation",
        //                 key: "Reservation",
        //                 type: "string",
        //                 typeInstance: new sap.ui.model.type.String()
        //             }
        //             // {
        //             //     label: "Description",
        //             //     key: "MaintenanceOrderDesc",
        //             //     type: "string",
        //             //     typeInstance: new sap.ui.model.type.String()
        //             // }
        //         ]);

        //         // Set Model
        //         this._oReserveVH.setModel(this.getView().getModel());

        //         //  Prepare Table
        //         this._oReserveVH.getTableAsync().then(function (oTable) {

        //             // Column: Maintenance Order
        //             oTable.addColumn(new sap.ui.table.Column({
        //                 label: new sap.m.Label({ text: "Reservation" }),
        //                 template: new sap.m.Text({ text: "{Reservation}" })
        //             }));

        //             // // Column: Description
        //             // oTable.addColumn(new sap.ui.table.Column({
        //             //     label: new sap.m.Label({ text: "Description" }),
        //             //     template: new sap.m.Text({ text: "{MaintenanceOrderDesc}" })
        //             // }));

        //             oTable.setSelectionMode("MultiToggle");

        //             this._oReserveVH.update();

        //         }.bind(this));
        //     }

        //     //  Initial Load
        //     this._loadMaintOrdersReserve("");

        //     this._oReserveVH.open();
        // },

        // _loadMaintOrdersReserve: function (sValue) {

        //     var oModel = this.getView().getModel();
        //     var aFilters = [];

        //     //  Search filter
        //     if (sValue) {
        //         aFilters.push(new sap.ui.model.Filter({
        //             filters: [
        //                 new sap.ui.model.Filter("Reservation", sap.ui.model.FilterOperator.Contains, sValue),

        //             ],
        //             and: false
        //         }));
        //     }

        //     oModel.read("/YY1_FLGTRK_Tracking_API", {

        //         filters: aFilters,

        //         urlParameters: {
        //             $select: "Reservation",
        //             $top: 10000
        //         },

        //         success: function (oData) {

        //             // Remove duplicates
        //             var oUniqueMap = new Map();

        //             oData.results.forEach(function (oItem) {
        //                 if (!oUniqueMap.has(oItem.Reservation)) {
        //                     oUniqueMap.set(oItem.Reservation, oItem);
        //                 }
        //             });

        //             var aUniqueData = Array.from(oUniqueMap.values());

        //             var oReserveVHModel = new sap.ui.model.json.JSONModel(aUniqueData);

        //             this._oReserveVH.getTableAsync().then(function (oTable) {
        //                 oTable.setModel(oReserveVHModel);
        //                 oTable.bindRows("/");
        //             });

        //         }.bind(this),

        //         error: function () {
        //             sap.m.MessageToast.show("Failed to load Reservation");
        //         }
        //     });
        // },
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

                                if (oRangeData.operation === "Contains") {
                                    sValue = "*" + sValue + "*";
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
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

        onDeliveryVHRqst: function () {

            if (!this._oDeliveryVH) {

                // Create the ValueHelpDialog
                this._oDeliveryVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Delivery",
                    supportRanges: true,        // Enables "Define Conditions" tab
                    supportRangesOnly: true,    // Only show Define Conditions
                    key: "Delivery",
                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrDelivery");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {
                            var oRangeData = oToken.data("range");

                            if (oRangeData) {
                                // Range token
                                var sValue = oRangeData.value1;

                                if (oRangeData.operation === "Contains") {
                                    sValue = "*" + sValue + "*";
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                            } else {
                                // Normal selection token
                                var sKey = oToken.getKey();
                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });

                        this._oDeliveryVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oDeliveryVH.close();
                    }.bind(this)
                });

                // Add to view
                this.getView().addDependent(this._oDeliveryVH);

                // Configure range key fields
                this._oDeliveryVH.setRangeKeyFields([
                    {
                        label: "Delivery",
                        key: "DeliveryNumber",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }
                ]);

            }

            // Open the ValueHelpDialog
            this._oDeliveryVH.open();
        },
          
         onPOVHRqst: function () {

            if (!this._oPOVH) {

                // Create the ValueHelpDialog
                this._oPOVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Purchase Order",
                    supportRanges: true,        // Enables "Define Conditions" tab
                    supportRangesOnly: true,    // Only show Define Conditions
                    key: "PurchaseOrder",
                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrPO");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {
                            var oRangeData = oToken.data("range");

                            if (oRangeData) {
                                // Range token
                                var sValue = oRangeData.value1;

                                if (oRangeData.operation === "Contains") {
                                    sValue = "*" + sValue + "*";
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                            } else {
                                // Normal selection token
                                var sKey = oToken.getKey();
                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });

                        this._oPOVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oPOVH.close();
                    }.bind(this)
                });

                // Add to view
                this.getView().addDependent(this._oPOVH);

                // Configure range key fields
                this._oPOVH.setRangeKeyFields([
                    {
                        label: "Purchase Order",
                        key: "PurchaseOrder",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }
                ]);

            }
            // Open the ValueHelpDialog
            this._oPOVH.open();
        },

        //STO
        onSTOVHRqst: function () {

            if (!this._oSTOVH) {

                // Create the ValueHelpDialog
                this._oSTOVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select STO",
                    supportRanges: true,        // Enables "Define Conditions" tab
                    supportRangesOnly: true,    // Only show Define Conditions
                    key: "STO",
                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrSTO");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {
                            var oRangeData = oToken.data("range");

                            if (oRangeData) {
                                // Range token
                                var sValue = oRangeData.value1;

                                if (oRangeData.operation === "Contains") {
                                    sValue = "*" + sValue + "*";
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                            } else {
                                // Normal selection token
                                var sKey = oToken.getKey();
                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });

                        this._oSTOVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oSTOVH.close();
                    }.bind(this)
                });

                // Add to view
                this.getView().addDependent(this._oPOVH);

                // Configure range key fields
                this._oSTOVH.setRangeKeyFields([
                    {
                        label: "STO",
                        key: "STO",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }
                ]);

            }
            // Open the ValueHelpDialog
            this._oSTOVH.open();
        },
        //PurchaseReq
        onPRVHRqst: function () {

            if (!this._oPRVH) {

                // Create the ValueHelpDialog
                this._oPRVH = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Select Purchase Requisition",
                    supportRanges: true,        // Enables "Define Conditions" tab
                    supportRangesOnly: true,    // Only show Define Conditions
                    key: "PurchaseRequisition",
                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrPurReq");

                        oMultiInput.removeAllTokens();

                        aTokens.forEach(function (oToken) {
                            var oRangeData = oToken.data("range");

                            if (oRangeData) {
                                // Range token
                                var sValue = oRangeData.value1;

                                if (oRangeData.operation === "Contains") {
                                    sValue = "*" + sValue + "*";
                                }

                                oMultiInput.addToken(new sap.m.Token({
                                    key: sValue,
                                    text: sValue
                                }));
                            } else {
                                // Normal selection token
                                var sKey = oToken.getKey();
                                if (sKey) {
                                    oMultiInput.addToken(new sap.m.Token({
                                        key: sKey,
                                        text: sKey
                                    }));
                                }
                            }

                        });

                        this._oPRVH.close();

                    }.bind(this),

                    cancel: function () {
                        this._oPRVH.close();
                    }.bind(this)
                });

                // Add to view
                this.getView().addDependent(this._oPRVH);

                // Configure range key fields
                this._oPRVH.setRangeKeyFields([
                    {
                        label: "Purchase Requisition",
                        key: "PurchaseRequisition",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }
                ]);

            }
            // Open the ValueHelpDialog
            this._oPRVH.open();
        },
       
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
                    descriptionKey: "ProductName",

                    ok: function (oEvent) {

                        var aTokens = oEvent.getParameter("tokens");
                        var oMultiInput = this.byId("idFltrMaterial");

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

                // FIX: Required for enabling input field
                this._oMaterialVH.setRangeKeyFields([
                    {
                        label: "Material",
                        key: "Material",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    },
                    {
                        label: "Material Description",
                        key: "ProductName",
                        type: "string",
                        typeInstance: new sap.ui.model.type.String()
                    }

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