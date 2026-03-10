const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_NAME = "Sheet1";

/**
 * MAIN POST HANDLER
 */
function doPost(e) {

  try {

    if (!e || !e.postData || !e.postData.contents) {

      return ContentService.createTextOutput(JSON.stringify({
        success:false,
        error:"No data received"
      })).setMimeType(ContentService.MimeType.JSON)

    }

    var data = JSON.parse(e.postData.contents)

    if (data.action === "submit_order") {
      return handleOrderSubmission(data)
    }

    else if (data.action === "update_approval") {
      return handleApprovalUpdate(data)
    }

    else if (data.action === "create_payment_sheet") {
      return handlePaymentSheet(data)
    }

    else{

      return ContentService.createTextOutput(JSON.stringify({
        success:false,
        error:"Unknown action"
      })).setMimeType(ContentService.MimeType.JSON)

    }

  }

  catch(err){

    return ContentService.createTextOutput(JSON.stringify({
      success:false,
      error:err.toString()
    })).setMimeType(ContentService.MimeType.JSON)

  }

}


/**
 * ORDER SUBMISSION
 */
function handleOrderSubmission(data){

  var sheet = getOrCreateSheet(SHEET_NAME,[
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
  ])

  var timestamp=new Date()
  var rows=[]

  if(data.bills && Array.isArray(data.bills)){

    data.bills.forEach(function(bill){

      rows.push([
        bill.id || generateID(),
        timestamp,
        data.email,
        data.unit,
        data.beneficiaryName,
        data.accountNo,
        data.ifscCode,
        bill.billDate || "",
        bill.dueDate || "",
        bill.amount || 0,
        "Pending",
        "",
        "",
        ""
      ])

    })

  }

  else{

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
      "Pending",
      "",
      "",
      ""
    ])

  }

  sheet.getRange(sheet.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows)

  return ContentService.createTextOutput(JSON.stringify({
    success:true
  })).setMimeType(ContentService.MimeType.JSON)

}



/**
 * APPROVAL UPDATE
 */
function handleApprovalUpdate(data){

  var sheet=SS.getSheetByName(SHEET_NAME)
  var values=sheet.getDataRange().getValues()

  for(var i=1;i<values.length;i++){

    var sheetId=(values[i][0] || "").toString()

    if(sheetId == data.orderId){

      sheet.getRange(i+1,11).setValue("Approved")
      sheet.getRange(i+1,12).setValue(data.approval.approval_timestamp)
      sheet.getRange(i+1,13).setValue(data.approval.approval_by_name)

      if(data.approval.payment_mode){
        sheet.getRange(i+1,14).setValue(data.approval.payment_mode)
      }

      break

    }

  }

  return ContentService.createTextOutput(JSON.stringify({
    success:true
  })).setMimeType(ContentService.MimeType.JSON)

}



/**
 * PAYMENT SHEET CREATION
 */
function handlePaymentSheet(data){

  var mode=data.paymentMode.toUpperCase()

  var sheetName="Payment_"+mode+"_"+getFormattedDate()

  var sheet
  var rows=[]

  // ======================
  // UBI FORMAT
  // ======================

  if(mode=="UBI"){

    sheet=getOrCreateSheet(sheetName,[

      "Client Code",
      "Customer Reference No",
      "Debit Account No.",
      "Transaction Type Code",
      "Message Type",
      "Beneficiary ID",
      "Beneficiary Name",
      "Beneficiary Account No.",
      "Beneficiary Bank",
      "Swift Code / IFSC Code",
      "Payment Amount",
      "Value Date",
      "Remarks"

    ])

    data.orders.forEach(function(order){

      rows.push([

        "GINZA01",
        order.id || "",
        "11079526893",
        "N",
        "NEFT",
        "",
        order.beneficiary_name || order.beneficiaryName,
        order.account_no || order.accountNo,
        "",
        order.ifsc_code || order.ifscCode,
        order.amount || 0,
        getFormattedDate(),
        "Bill Payment"

      ])

    })

  }


  // ======================
  // SBI FORMAT
  // ======================

  else if(mode=="SBI"){

    sheet=getOrCreateSheet(sheetName,[

      "Sr.No",
      "Corp ID",
      "Customer Name",
      "Debit A/c No.",
      "Type",
      "Date of TXn",
      "Amount",
      "Beneficiery Name",
      "IFSC Code",
      "Beneficiery A/c No.",
      "Remark"

    ])

    var startRow=sheet.getLastRow()

    data.orders.forEach(function(order,index){

      rows.push([

        startRow + index,
        "303137",
        "GINZA INDUSTRIES LIMITED",
        "11079526893",
        "NEFT",
        getFormattedDate(),
        order.amount || 0,
        order.beneficiary_name || order.beneficiaryName,
        order.ifsc_code || order.ifscCode,
        order.account_no || order.accountNo,
        "Bill Payment"

      ])

    })

  }


  if(rows.length>0){
    sheet.getRange(sheet.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows)
  }

  return ContentService.createTextOutput(JSON.stringify({
    success:true,
    sheetName:sheetName
  })).setMimeType(ContentService.MimeType.JSON)

}



/**
 * CREATE SHEET IF NOT EXIST
 */
function getOrCreateSheet(name,headers){

  var sheet=SS.getSheetByName(name)

  if(!sheet){

    sheet=SS.insertSheet(name)

    sheet.appendRow(headers)

  }

  return sheet

}



/**
 * UNIQUE ID
 */
function generateID(){

  return "ORD-"+new Date().getTime()

}



/**
 * DATE FORMAT
 */
function getFormattedDate(){

  var d=new Date()

  var day=("0"+d.getDate()).slice(-2)
  var mon=("0"+(d.getMonth()+1)).slice(-2)
  var yr=d.getFullYear()

  return day+"-"+mon+"-"+yr

}



/**
 * GET REQUEST HANDLER
 */
function doGet(e){

  if(e && e.parameter && e.parameter.action=="read_sheet"){

    try{

      var sheetName=e.parameter.sheetName || SHEET_NAME

      var sheet=SS.getSheetByName(sheetName)

      if(!sheet){

        return ContentService.createTextOutput(JSON.stringify({
          success:false,
          error:"Sheet not found"
        })).setMimeType(ContentService.MimeType.JSON)

      }

      var data=sheet.getDataRange().getValues()

      return ContentService.createTextOutput(JSON.stringify({
        success:true,
        data:data
      })).setMimeType(ContentService.MimeType.JSON)

    }

    catch(err){

      return ContentService.createTextOutput(JSON.stringify({
        success:false,
        error:err.toString()
      })).setMimeType(ContentService.MimeType.JSON)

    }

  }


  return ContentService.createTextOutput(

    "✅ Ginza Bill Submission System is Active and Running.\n\n" +
    "Available Actions:\n" +
    "1. submit_order - Submit new orders\n" +
    "2. update_approval - Update approval status\n" +
    "3. create_payment_sheet - Create payment mode sheet\n" +
    "4. read_sheet - Fetch data from sheets (via GET action=read_sheet)"

  )

}
