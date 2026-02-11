// IMPORTANT: PASTE YOUR SPREADSHEET ID HERE
// You can find it in your Google Sheet URL: https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit
var SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE'; 

// Handle GET requests
function doGet(e) {
  return ContentService.createTextOutput("Ticketing System Backend is Online.\n\nPlease use the local frontend to submit tickets.");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

// Handle POST requests for API usage
function doPost(e) {
  var result = {
    status: 'error',
    message: 'Invalid request'
  };
  
  try {
    var postData = e.postData.contents;
    var data = JSON.parse(postData);
    
    if (data.action === 'getTickets') {
      result = getTickets();
    } else if (data.action === 'updateTicket') {
      result = updateTicket(data);
    } else if (data.action === 'deleteTicket') {
      result = deleteTicket(data);
    } else if (data.action === 'createTicket') {
      result = submitTicket(data);
    } else {
      // Default to submitTicket for backward compatibility or handle unknown action
      result = submitTicket(data);
    }
  } catch (error) {
    result.message = "Server Error: " + error.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTickets() {
  try {
    var ss;
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
      try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch(e) {}
    }
    if (!ss) { try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {} }
    
    if (!ss) throw new Error("Could not connect to Google Sheet.");
    
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) {
       if (ss.getSheets().length > 0) sheet = ss.getSheets()[0];
       else throw new Error("No sheets found.");
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var tickets = [];
    
    // Convert rows to objects (skipping header)
    // Assumed Headers order based on submitTicket: 
    // ID, Subject, Description, Requester Name, Assigned To, Category, Priority, Status, Ticket Date, Time Start, Time End, Attachments, Department, Ticket Type
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      tickets.push({
        id: row[0],
        subject: row[1],
        description: row[2],
        requesterName: row[3],
        assignedTo: row[4],
        category: row[5],
        priority: row[6],
        status: row[7],
        date: row[8],
        department: row[12],
        ticketType: row[13]
      });
    }
    
    // Reverse to show newest first
    tickets.reverse();
    
    return {
      status: 'success',
      data: tickets
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

function submitTicket(data) {
  try {
    console.log('Received ticket data:', data);
    
    var ss;
    
    // 1. Try to open by ID first (Most reliable for standalone scripts)
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
      try {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      } catch (e) {
        console.error("Could not open by ID: " + e.toString());
      }
    }
    
    // 2. Fallback: Try to get active spreadsheet (Only works if script is container-bound)
    if (!ss) {
      try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      } catch (e) {
        console.error("Could not get active spreadsheet: " + e.toString());
      }
    }
    
    if (!ss) {
      throw new Error("Could not connect to Google Sheet. Please make sure you pasted the SPREADSHEET_ID in Code.gs line 3.");
    }
    
    // Get the sheet
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) {
      // Try creating it or using the first one
      if (ss.getSheets().length > 0) {
        sheet = ss.getSheets()[0];
      } else {
         throw new Error("No sheets found in the spreadsheet.");
      }
    }
    
    // Generate simple ID
    var id = 'T-' + new Date().getTime().toString().substr(-6) + Math.floor(Math.random() * 1000);
    var ticketDate = new Date();
    var status = 'Pending';
    var timeStart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");
    
    // Append the row
    // Columns: ID, Subject, Description, Requester Name, Assigned To, Category, Priority, Status, Ticket Date, Time Start, Time End, Attachments, Department, Ticket Type
    sheet.appendRow([
      id, 
      data.subject, 
      data.description, 
      data.requesterName, 
      '', // Assigned To
      data.category, 
      data.priority, 
      status, 
      ticketDate, 
      timeStart, // Time Start
      '', // Time End
      '', // Attachments
      data.department, 
      data.ticketType
    ]);
    
    return {
      status: 'success',
      message: 'Ticket submitted successfully! Ticket ID: ' + id
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

function updateTicket(data) {
  try {
    var ss;
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
      try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch(e) {}
    }
    if (!ss) { try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {} }
    
    if (!ss) throw new Error("Could not connect to Google Sheet.");
    
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) throw new Error("Tickets sheet not found.");
    
    var id = data.id;
    var newStatus = data.status;
    
    if (!id || !newStatus) throw new Error("Missing ID or Status.");
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var rowIndex = -1;
    
    // Find the row by ID (Column 0)
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] == id) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (rowIndex === -1) throw new Error("Ticket ID not found.");
    
    // Update Status if provided
    if (newStatus) {
      sheet.getRange(rowIndex, 8).setValue(newStatus);
      
      // Update Time End if Resolved or Cancelled (Column 11 -> Index 10+1 = 11)
      if (newStatus === 'Resolved' || newStatus === 'Cancelled' || newStatus === 'Closed') {
         var timeEnd = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");
         sheet.getRange(rowIndex, 11).setValue(timeEnd);
      }
    }
    
    // Update other fields if provided
    if (data.subject) sheet.getRange(rowIndex, 2).setValue(data.subject);
    if (data.description) sheet.getRange(rowIndex, 3).setValue(data.description);
    if (data.requesterName) sheet.getRange(rowIndex, 4).setValue(data.requesterName);
    if (data.assignedTo !== undefined) sheet.getRange(rowIndex, 5).setValue(data.assignedTo); // Col 5
    if (data.department) sheet.getRange(rowIndex, 13).setValue(data.department); // Col 13
    if (data.ticketType) sheet.getRange(rowIndex, 14).setValue(data.ticketType); // Col 14
    if (data.category) sheet.getRange(rowIndex, 6).setValue(data.category); // Col 6
    if (data.priority) sheet.getRange(rowIndex, 7).setValue(data.priority); // Col 7
    
    return {
      status: 'success',
      message: 'Ticket updated successfully.'
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

function deleteTicket(data) {
  try {
    var ss;
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
      try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch(e) {}
    }
    if (!ss) { try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {} }
    
    if (!ss) throw new Error("Could not connect to Google Sheet.");
    
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) throw new Error("Tickets sheet not found.");
    
    var id = data.id;
    if (!id) throw new Error("Missing ID.");
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var rowIndex = -1;
    
    // Find the row by ID (Column 0)
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] == id) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (rowIndex === -1) throw new Error("Ticket ID not found.");
    
    // Delete the row
    sheet.deleteRow(rowIndex);
    
    return {
      status: 'success',
      message: 'Ticket deleted successfully.'
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: error.toString()
    };
  }
}
