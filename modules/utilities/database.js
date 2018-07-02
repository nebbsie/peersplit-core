var mysql = require('mysql');
var bcrypt = require('bcrypt');
const saltRounds = 10;


/*
    ======================================
                    TODO
    ======================================
    - Modify the user.
    - When deleting a file/chunks. Set a job to be done.
    - When deleting a holder. Set a job to be done.
    - Add/Delete/Update jobs.
*/

//=====================================================================//
//                        Database Connection                          //
//=====================================================================//

// Database connection variable.
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "peersplit"
});

// Connect to the database.
con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

//=====================================================================//
//                            File Helper                              //
//=====================================================================//
/**
 *  Creates a new file in the database.
 * @method newFile
 * @param {String} filename  the file name of the file being put into the database.
 * @param {String[]} chunks  array of names of the chunks created.
 * @param {int} ownerID  id of the user that uploaded the file.
 * @return {bool}  if successfull
 */
exports.newFile = function (filename, chunks, ownerID, fileSize, callback) {
    var sql = `INSERT INTO files (filename, chunks,size ,ownerID) 
               VALUES ('${filename}',${chunks.length},${fileSize},${ownerID})`;

    con.query(sql, function (err, result) {
        if (err)
            callback(true);
        else {
            // Go through each chunk and add it to the chunk list.
            for (var i = 0; i < chunks.length; i++) {
                exports.newChunk(chunks[i].name, chunks[i].holderID, result.insertId, function (err) {
                    if (err) {
                        callback(true);
                        return;
                    }
                });
            }
            callback(false);
        }
    });
}

/**
 *  Deletes a file from the datbase.
 * @method deleteFile
 * @param {String} filename  the file name of the file being delete from the database.
 * @param {String[]} ownerID  id of the owner of the file.
 * @return {bool}  if successfull
 */
exports.deleteFile = function (filename, ownerID, callback) {
    var sqlGetID = `SELECT id FROM files WHERE filename = '${filename}' AND ownerID = ${ownerID}`

    con.query(sqlGetID, function (err, result) {
        if (err)
            callback(true, 'error deleting file');
        else {
            if (result.affectedRows == 0)
                callback(true, 'no file to delete')
            else {
                var fileID = result[0].id;
                var sql = `DELETE FROM files WHERE filename = '${filename}' AND ownerID = ${ownerID}`

                con.query(sql, function (err, result) {
                    if (err)
                        callback(true, 'error deleting file');
                    else {
                        var sql = `DELETE FROM chunks WHERE fk_fileID = ${fileID}`

                        con.query(sql, function (err, result) {
                            if (err)
                                callback(true, 'error deleting file');
                            else {
                                //TODO: Set a job, as the chunks no longer need to be stored.
                                callback(false)
                            }
                        })
                    }
                })
            }
        }
    })
}

/**
 *  Create a new chunk in the database.
 * @method newChunk
 * @param {String} filename  the file name of the chunk being put into the database.
 * @param {int} holderID  id of the holder device that is storing the chunk.
 * @param {int} fileID  id of the file that the chunk came from.
 * @return {bool}  if successfull.
 */
exports.newChunk = function (chunkName, holderID, fileID, callback) {
    var sql = `INSERT INTO chunks (chunkName, fk_holderID, fk_fileID) 
               VALUES ('${chunkName}',${holderID},${fileID})`;
    con.query(sql, function (err, result) {
        if (err)
            callback(true);
        else
            callback(false);
    });
}

/**
 *   Returns a list of files that have been uploaded by a user.
 * @method getFiles
 * @param {int} ownerID  the id of the users whose files will be returned.
 * @return {bool}  if successfull.
 * @return {json}  files that the user owns.
 */
exports.getFiles = function (ownerID, callback) {
    var sql = `SELECT * FROM files WHERE ownerID = ${ownerID}`;

    con.query(sql, function (err, result) {
        if (err)
            callback(true);
        else
            callback(false, result);
    });
}

/**
 *   Take a file and check if it has been uploaded.
 * @method checkIfAlreadyUploaded
 * @param {int} title  the title of the file to check if already in network.
 * @return {bool}  if successfull.
 * @return {bool}  if it has been already uploaded.
 */
exports.checkIfAlreadyUploaded = function (title, callback) {
    var sql = `SELECT * FROM files WHERE filename = '${title}'`

    con.query(sql, function (err, result) {
        if (err)
            callback(err, null)
        else {
            if (result.length > 0)
                callback(false, true);
            else
                callback(false, false);
        }
    })
}

//=====================================================================//
//                            Holder Helper                            //
//=====================================================================//
/**
 *  Create a new holder.
 * @method createHolder
 * @param {int} ownerID  the id of user that owns the holder device
 * @param {int} bytesAvailable  how many bytes are free on the holder device.
 * @param {string} holderName  name given to the holder device.
 * @return {bool} if successfull
 */
exports.createHolder = function (ownerID, bytesAvailable, holderName, callback) {
    var epoch = getEpoch();
    var sql = `INSERT INTO holder (bytesAvailable, fk_userID, holderName, lastOnline) VALUES (${bytesAvailable},${ownerID}, '${holderName}', ${epoch})`;

    con.query(sql, function (err, result) {
        if (err)
            callback(err);
        else
            callback(false);
    })
}

/**
 *  Delete a holder.
 * @method deleteHolder
 * @param {int} holderID  the id of the holder device to delete
 * @param {int} ownerID  the owner id of the holder.
 * @return {bool} if successfull
 */
exports.deleteHolder = function (holderID, ownerID, callback) {
    var sql = `DELETE FROM holder WHERE id=${holderID} AND fk_userID=${ownerID}`;

    con.query(sql, function (err, result) {
        if (err)
            callback(err, 'failed to delete user')
        else {
            if (result.affectedRows == 0) {
                callback(true, 'no holder to delete')
            } else {
                //TODO: Create a job as a new copy of chunks being held on device need to be moved.
                callback(false);
            }
        }

    })
}

/**
 *  Update the last online time of a holder device.
 * @method updateUserTime
 * @param {int} holderID  the id of the holder device.
 * @return {bool} if successfull
 */
exports.updateUserTime = function (holderID, callback) {
    var epoch = getEpoch();
    var sql = `UPDATE holder SET lastOnline = ${epoch} WHERE id = ${holderID}`;

    con.query(sql, function (err, result) {
        if (err)
            callback(true);
        else {
            callback(false);
        }
    });
}

/**
 *  Get all holders for an account, based on the id.
 * @method getHoldersWithID
 * @param {int} ownerID  the id of the owner of the device.
 * @return {bool} if successfull
 * @return {json} the holders
 */
exports.getHoldersWithID = function (ownerID, callback) {
    var sql = `SELECT * FROM holder WHERE fk_userID = ${ownerID}`;

    con.query(sql, function (err, result) {
        if (err)
            callback(true, null);
        else
            callback(false, result);
    });
}

/**
 *  Gets all of the online devices, gives option to exclude current device.
 * @method getOnlineHolders
 * @param {int} holderID  the id of the holder device to ignore.
 * @param {bool} shouldExclude  determines if to include the current device or not. If true, exclude it.
 * @return {bool} if successfull
 * @return {json} the holders
 */
exports.getOnlineHolders = function (holderID, shouldExclude, callback) {
    var bufferTime = 50000000; // 5 second accuracy.
    var onlineTime = getEpoch() - bufferTime;
    var sql = `SELECT * FROM holder WHERE lastOnline > ${onlineTime}`;

    if (shouldExclude)
        sql += ` AND id != ${holderID}`;

    con.query(sql, function (err, result) {
        if (err)
            callback(err);
        else
            callback(false, result);
    })
}

//=====================================================================//
//                               Users                                 //
//=====================================================================//

/**
 *  Create a user with the given parameters
 * @method createUser
 * @param {string} username username for the user.
 * @param {string} email email to use for the user.
 * @param {string} password password to use for the user.
 * @return {bool} if successfull
 */
exports.createUser = function (username, email, password, callback) {
    bcrypt.genSalt(saltRounds, function (err, salt) {
        if (err)
            callback(err)
        else {
            bcrypt.hash(password, salt, function (err, hash) {
                if (err)
                    callback(err)
                else {
                    var sql = `INSERT INTO users (username, email, password) VALUES ('${username}','${email}','${hash}')`
                    con.query(sql, function (err) {
                        if (err)
                            callback(err)
                        else
                            callback(false)
                    })
                }
            })
        }
    })
}

/**
 *  Login with the given params.
 * @method loginUser
 * @param {string} username username for the user.
 * @param {string} password password for the user.
 * @return {bool} if successfull
 */
exports.loginUser = function (username, password, callback) {
    var sql = `SELECT * FROM users WHERE username = '${username}'`

    con.query(sql, function (err, data) {
        if (err)
            callback(err)
        else {
            if (data.length == 0)
                callback(true)
            else {
                bcrypt.compare(password, data[0].password, function (err, doesMatch) {
                    if (err)
                        callback(err)
                    else {
                        if (doesMatch) {
                            delete data[0]['password']
                            callback(false, data[0])
                        } else {
                            callback(true)
                        }
                    }
                })
            }
        }
    })
}

/**
 *  Deletes a user using the username and password.
 * @method deleteUser
 * @param {string} username username for the user.
 * @param {string} password password for the user.
 * @return {bool} if successfull
 */
exports.deleteUser = function (username, password, callback) {
    var sql = `SELECT * FROM users WHERE username = '${username}'`

    con.query(sql, function (err, data) {
        if (err)
            callback(err)
        else {
            if (data.length == 0)
                callback(true)
            else {
                bcrypt.compare(password, data[0].password, function (err, doesMatch) {
                    if (err)
                        callback(err)
                    else {
                        if (doesMatch) {
                            var sql = `DELETE FROM users WHERE username = '${username}'`
                            con.query(sql, function (err, results) {
                                if (err) {
                                    console.log(err)
                                    callback(true)
                                } else {

                                    callback(false)
                                }
                            })
                        } else {
                            callback(true)
                        }
                    }
                })
            }
        }
    })
}

//=====================================================================//
//                            Utilities                                //
//=====================================================================//
/**
 *  Returns the current epoch seconds.
 * @method getEpoch
 * @return {int} the current epoch time.
 */
function getEpoch() {
    return Math.round((new Date()).getTime() / 1000);
}