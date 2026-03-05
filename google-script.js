const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_NAME = "Sheet1";

/**
 * ✅ Main Handler - When data is sent from server
 */
function doPost(e) {
  try {
    // Check if postData exists
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("❌ No POST data received");
      return ContentService.createTextOutput(JSON.stringify({ 
        "success": false, 
        "error": "No data received" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // Parse the incoming data
    var data = JSON.parse(e.postData.contents);
    Logger.log("📥 Received data: " + JSON.stringify(data));

    // Check action type and handle accordingly
    if (data.action === "submit_order") {
      return handleOrderSubmission(data);
    } 
    else if (data.action === "update_approval") {
      return handleApprovalUpdate(data);
    } 
    else if (data.action === "create_payment_sheet") {
      return handlePaymentSheet(data);
    }
    else {
      return ContentService.createTextOutput(JSON.stringify({ 
        "success": false, 
        "error": "Unknown action: " + data.action 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (err) {
    Logger.log("❌ Error in doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": false, 
      "error": err.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ✅ Handle Order Submission
 */
function handleOrderSubmission(data) {
  try {
    Logger.log("📝 Processing order submission...");

    // Ensure required fields exist
    if (!data.email || !data.unit || !data.beneficiaryName) {
      return ContentService.createTextOutput(JSON.stringify({ 
        "success": false, 
        "error": "Missing required fields" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // Get or create sheet with headers
    var sheet = getOrCreateSheet(SHEET_NAME, [
      "ID",
      "Timestamp", 
      "Email", 
      "Unit", 
      "Beneficiary Name", 
      "Account No", 
      "IFSC Code", 
      "Bill Date", 
      "Due Date", 
      "Amount",
      "Status",
      "Approval Timestamp",
      "Approved By",
      "Payment Mode"
    ]);
    
    var timestamp = new Date();
    var rows = [];
    
    // Process bills array
    if (data.bills && Array.isArray(data.bills) && data.bills.length > 0) {
      data.bills.forEach(function(bill) {
        rows.push([
          bill.id || generateID(),                // ID (Use ID from server if available)
          timestamp,                              // Timestamp
          data.email,                             // Email
          data.unit,                              // Unit
          data.beneficiaryName,                   // Beneficiary Name
          data.accountNo,                         // Account No
          data.ifscCode,                          // IFSC Code
          bill.billDate || "",                    // Bill Date
          bill.dueDate || "",                     // Due Date
          bill.amount || 0,                       // Amount
          data.status || "Pending",               // Status
          data.approvalTimestamp || "",           // Approval Timestamp
          data.approvedBy || "",                  // Approved By
          data.paymentMode || ""                  // Payment Mode
        ]);
      });
    } else {
      // Single bill entry
      rows.push([
        generateID(),
        timestamp,
        data.email,
        data.unit,
        data.beneficiaryName,
        data.accountNo || "",
        data.ifscCode || "",
        data.billDate || "",
        data.dueDate || "",
        data.amount || 0,
        data.status || "Pending",
        data.approvalTimestamp || "",
        data.approvedBy || "",
        data.paymentMode || ""
      ]);
    }
    
    // Append rows to sheet
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log("✅ " + rows.length + " order(s) submitted successfully");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": true, 
      "message": rows.length + " order(s) saved to Sheet1",
      "rowsAdded": rows.length
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log("❌ Submission Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": false, 
      "error": "Submission failed: " + err.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ✅ Handle Approval Updates
 */
function handleApprovalUpdate(data) {
  try {
    Logger.log("✏️ Processing approval update...");
    Logger.log("Data received: " + JSON.stringify(data));

    var sheet = SS.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ 
        "success": false, 
        "error": "Sheet '" + SHEET_NAME + "' not found" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    var range = sheet.getDataRange();
    var values = range.getValues();
    
    var found = false;
    var updatedCount = 0;

    // Search through all rows
    for (var i = 1; i < values.length; i++) {
      // 1. Primary Match: ID (Column A - Index 0)
      var sheetId = (values[i][0] || "").toString().trim();
      var targetId = (data.orderId || "").toString().trim();
      var idMatch = targetId !== "" && sheetId === targetId;
      
      // 2. Secondary Match (Fallback): Email + Beneficiary + Amount + Bill Date
      var emailMatch = values[i][2] == data.email;
      var beneficiaryMatch = values[i][4] == data.beneficiaryName;
      var amountMatch = Math.abs(parseFloat(values[i][9] || 0) - parseFloat(data.amount || 0)) < 0.01;
      
      // Handle Date comparison robustly
      var rowDateVal = values[i][7];
      var rowDateStr = "";
      if (rowDateVal instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDateVal, SS.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      } else {
        rowDateStr = rowDateVal.toString();
      }
      
      var targetDateStr = data.billDate; 
      var dateMatch = (rowDateStr === targetDateStr);

      // If ID matches OR (all secondary fields match and we don't have an ID)
      if (idMatch || (emailMatch && beneficiaryMatch && amountMatch && dateMatch)) {
        // Update Status (Column 11 - K)
        sheet.getRange(i + 1, 11).setValue("Approved");
        
        // Update Approval Timestamp (Column 12 - L)
        sheet.getRange(i + 1, 12).setValue(data.approval.approval_timestamp);
        
        // Update Approved By (Column 13 - M)
        sheet.getRange(i + 1, 13).setValue(data.approval.approval_by_name);
        
        // Update Payment Mode (Column 14 - N)
        if (data.approval.payment_mode) {
          sheet.getRange(i + 1, 14).setValue(data.approval.payment_mode);
        }

        // Format the updated row
        sheet.getRange(i + 1, 11, 1, 4).setBackground("#90EE90").setFontWeight("bold");

        Logger.log("✅ Row " + (i+1) + " updated successfully");
        found = true;
        updatedCount = 1;
        
        // IMPORTANT: Stop searching after finding the FIRST match.
        // This prevents updating multiple rows for the same customer.
        break; 
      }
    }
    
    if (!found) {
      Logger.log("⚠️ No matching record found for: Email=" + data.email + ", Beneficiary=" + data.beneficiaryName + ", Date=" + data.billDate);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": true, 
      "message": "Approval update processed",
      "found": found,
      "updatedCount": updatedCount
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log("❌ Approval Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": false, 
      "error": "Approval update failed: " + err.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ✅ Create separate Payment Mode Sheet
 */
function handlePaymentSheet(data) {
  try {
    Logger.log("💳 Creating payment sheet...");

    if (!data.paymentMode) {
      return ContentService.createTextOutput(JSON.stringify({ 
        "success": false, 
        "error": "Payment mode is required" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    var sheetName = "Payment_" + data.paymentMode + "_" + getFormattedDate();
    var newSheet = getOrCreateSheet(sheetName, [
      "Date",
      "Order ID",
      "Payment Mode",
      "Beneficiary Name",
      "Account No",
      "IFSC Code",
      "Amount",
      "Approved By"
    ]);
    
    var rows = [];
    
    if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
      data.orders.forEach(function(order) {
        rows.push([
          getFormattedDate(),
          order.id || "",
          data.paymentMode,
          order.beneficiary_name || order.beneficiaryName || "",
          order.account_no || order.accountNo || "",
          order.ifsc_code || order.ifscCode || "",
          order.amount || 0,
          data.approval_by_name || ""
        ]);
      });
    }
    
    if (rows.length > 0) {
      newSheet.getRange(newSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      newSheet.getRange(newSheet.getLastRow() - rows.length + 1, 1, rows.length, 6).setBackground("#E8F5E9");
      Logger.log("✅ Payment sheet created with " + rows.length + " rows");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": true, 
      "message": "Payment sheet created: " + sheetName,
      "sheetName": sheetName,
      "rowsAdded": rows.length
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log("❌ Payment Sheet Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": false, 
      "error": "Payment sheet creation failed: " + err.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ✅ Helper: Get or Create Sheet
 */
function getOrCreateSheet(sheetName, headers) {
  var sheet = SS.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = SS.insertSheet(sheetName);
    Logger.log("📄 Created new sheet: " + sheetName);
    
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#4285F4")
        .setFontColor("white")
        .setHorizontalAlignment("center");
      
      // Auto-resize columns
      sheet.autoResizeColumns(1, headers.length);
    }
  }
  
  return sheet;
}

/**
 * ✅ Helper: Generate Unique ID
 */
function generateID() {
  var date = new Date();
  var timestamp = date.getTime();
  var random = Math.random().toString(36).substring(2, 9);
  return "ORD-" + timestamp + "-" + random;
}

/**
 * ✅ Helper: Get Formatted Date (DD-MM-YYYY)
 */
function getFormattedDate() {
  var date = new Date();
  var day = date.getDate().toString().padStart(2, '0');
  var month = (date.getMonth() + 1).toString().padStart(2, '0');
  var year = date.getFullYear();
  return day + "-" + month + "-" + year;
}

/**
 * ✅ GET Request Handler
 */
function doGet(e) {
  if (e.parameter.action === "read_sheet") {
    try {
      var sheetName = e.parameter.sheetName || SHEET_NAME;
      var sheet = SS.getSheetByName(sheetName);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      var data = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: data })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(
    "✅ Ginza Bill Submission System is Active and Running.\n\n" +
    "Available Actions:\n" +
    "1. submit_order - Submit new orders\n" +
    "2. update_approval - Update approval status\n" +
    "3. create_payment_sheet - Create payment mode sheet\n" +
    "4. read_sheet - Fetch data from sheets (via GET action=read_sheet)"
  );
}
