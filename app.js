// Imports
var express = require('express') // Web server.
var fs = require('fs-extra') // File system calls.
var mkdirp = require('mkdirp') // Used to create folders.
var bodyParser = require('body-parser') // Make parsing body post data easy.
const fileUpload = require('express-fileupload') // File upload helper.
var crypto = require('crypto') //Encryption libraries.

// Own  modules
var db = require('./modules/utilities/database') // Holds all of the database calls.
var response = require('./modules/utilities/response') // Returns different types response to user.
var fileHelper = require('./modules/helpers/fileHelper') // Returns the file functions.

// Express
var app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// Middleware
app.use(fileUpload())

// Variables
var port = process.env.port | 3000

/*
    ======================================
                    TODO
    ======================================
    - Encrypt the file if it has not been encrypted yet.
    - Request/Accept chunk download
    - Request/Accept file download

*/

app.get('/', function(req, res){
    res.send(response.getSuccessResponse('aaron nebbs'))
})

//=====================================================================//
//                         File Functionality                          //
//=====================================================================//

// Gets the list of files in the network that have been uploaded by the user.
app.post('/file/getAll', function(req, res){
    let ownerID = req.body.ownerID
    // Return list of files uploaded into network by user.
    db.getFiles(ownerID, function(err, files){
        if (err)
            res.send(response.getErrorResponse(err))
        else
            res.send(response.getSuccessResponse(files))
    })
})

// File upload function
app.post('/file/new', function(req, res) {
    // Check if files have been uploaded.
    if (!req.files) 
        res.send(response.getErrorResponse("no files were sent to the api"))
    
    let fileToSplit = req.files.file
    let fileName = fileToSplit.name
    let dir = "upload/" + fileName.replace('.', '')

    // Create a location 
    let fileLoc = dir + "/" + fileName
    let ownerID = req.body.ownerID

    // Before doing anything fileIO make sure the file is not already uploaded.
    db.checkIfAlreadyUploaded(fileName, function(err, exists){
        if (err)
            res.send(response.getErrorResponse("failed to check if file already exists"))
        else if (!exists) {
            // Attempt to create the directory to store the file upload.
            mkdirp(dir, function (err) {
                // If error don't carry on trying to split.
                if (err)
                    res.send(response.getErrorResponse("failed with file io"))
                else {
                    // Move the file to the correct directory.
                    fileToSplit.mv(fileLoc, function(err) {
                        // If error moving the file dont carry on.
                        if (err)
                            res.send(response.getErrorResponse("failed with file io"))
                        // Attempt to compress the file.
                        fileHelper.compress(fileLoc, function(err, compressedFile){
                            // If error compressing return an error message.
                            if (err)
                                res.send(response.getErrorResponse("error during compression"))
                            else {
                                var hash = crypto.createHash('md5').update(fileName).digest('hex')
                                // Split the file into chunks.
                                fileHelper.fileSplitter(compressedFile, fileName,hash, function(err, chunksNames){
                                    // If the file splitter fails return an error message.
                                    if (err)
                                        res.send(response.getErrorResponse("error splitting the file"))
                                    else {
                                        // Get the holders for the chunks.
                                        fileHelper.findHoldersForChunks(chunksNames, ownerID, function(err, chunksWithHolderID){
                                            if (err)
                                                res.send(response.getErrorResponse("failed to find holders for the chunks"))
                                            else {
                                                // Put the files into the database.
                                                db.newFile(fileName, chunksWithHolderID, ownerID, function(err){
                                                    if (err){
                                                        //TODO: cleanup unused folders.
                                                        res.send(response.getErrorResponse("failed to upload file to database"))
                                                    }
                                                    else {
                                                        res.send(response.getSuccessResponse("updated file"))
                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    })
                }
            }) 
        }else {
            // File exists
            res.send(response.getSuccessResponse('file already in the network.'))
        }        
    })
})

// Delete file from the database, and also all of the chunks.
app.post('/file/delete', function(req, res) {
    var filename = req.body.del_filename;
    var ownerID = req.body.del_ownerID;

    db.deleteFile(filename, ownerID, function(err, msg) {
        if (err)
            res.send(response.getErrorResponse(msg))
        else
            res.send(response.getSuccessResponse('deleted file'))
    })
})

//=====================================================================//
//                       Holder Functionality                          //
//=====================================================================//

// Create a new holder.
app.post('/holder/create', function(req, res) {
    let holderID = req.body.holderID
    let holderName = req.body.holderName
    let bytesAvailable = req.body.bytesAvailable
    db.createHolder(holderID, bytesAvailable, holderName, function(err){
        if (err)
            res.send(response.getErrorResponse('failed to create holder'))
        else
            res.send(response.getSuccessResponse('created a new holder'))
    })
})

// Delete a holder.
app.post('/holder/delete', function(req, res) {
    let holderID = req.body.del_holderID
    let ownerID = req.body.del_ownerID

    db.deleteHolder(holderID, ownerID, function(err, msg){
        if (err)
            res.send(response.getErrorResponse(msg))
        else
            res.send(response.getSuccessResponse('deleted the holder'))
    })
})

// Update the holder last online time.
app.post('/holder/update', function(req, res) {
    let holderID = req.body.holderID
    db.updateUserTime(holderID, function(err){
        if (err)
            res.send(response.getErrorResponse('failed to update the time'))
        else
            res.send(response.getSuccessResponse('updated the online time'))
    })
})

// Returns all of the holder devices that the user currently has.
app.post('/holder/getHoldersWithID', function(req, res) {
    var ownerID = req.body.ownerID
    db.getHoldersWithID(ownerID, function(err, result){
        if (err)
            res.send(response.getErrorResponse('failed to get the holders for id ' , ownerID))
        else {
            res.send(response.getSuccessResponse(result))
        }
    })
})

//=====================================================================//
//                         User Functionality                          //
//=====================================================================//

// Create a user account.
app.post('/user/create', function(req, res) {
    var username = req.body.reg_username
    var email = req.body.reg_email
    var password = req.body.reg_password

    db.createUser(username, email, password, function(err){
        if (err)
            res.send(response.getErrorResponse('failed to create account'))
        else
            res.send(response.getSuccessResponse('created a new user account'))
    })
})

// Login user and return user data
app.post('/user/login', function(req, res) {
    var username = req.body.log_username
    var password = req.body.log_password

    console.log(username , password)

    db.loginUser(username, password, function(err, data){
        if (err)
            res.send(response.getErrorResponse('failed to login'))
        else
            res.send(response.getSuccessResponse(data))
    })
})

// Delete user account
app.post('/user/delete', function(req, res) {
    var username = req.body.del_username
    var password = req.body.del_password

    db.deleteUser(username, password, function(err, data){
        if (err)
            res.send(response.getErrorResponse('failed to delete account'))
        else
            res.send(response.getSuccessResponse('succesfully deleted account'))
    })
})

//=====================================================================//
//                         Storage Information                         //
//=====================================================================//

app.post('/storage/tier', function(req, res){
    var tier = req.body.tier;
    var tiers = [5000, 100000, 1000000]
    res.send(response.getSuccessResponse(tiers[tier]))
})

//=====================================================================//
//                             Express                                 //
//=====================================================================//

// Listen for user requests.
app.listen(port, function () {
    console.log('Example app listening on port: ' + port)
})