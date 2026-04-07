sap.ui.define([], function () {
    "use strict";
    return {
        
        formatCustomDate: function (sValue) {
            if (!sValue) {
                return "";
            }
            try {
                // Parse the string into a Date object
                var oDate = new Date(sValue);
                if (isNaN(oDate.getTime())) {
                    return ""; // Invalid date
                }

                // Format as dd.M.yyyy
                var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "dd-MM-yyyy"
                });
                return oDateFormat.format(oDate);
            } catch (e) {
                return "";
            }
        }
    };
});
