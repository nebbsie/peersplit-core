var fs = require('fs-extra') // File system calls.
const zlib = require('zlib') // Compression libraries.
var crypto = require('crypto') //Encryption libraries.
const splitFile = require('split-file') // Library to split files.


// Compress the given file.
exports.compress = function(fileLoc, callback) {
    // Create the location for the compressed file.
    let outputLoc = (fileLoc + '.gz').replace(' ', '');
    // Create the output file for the compressed data.
    let outputFile = fs.createWriteStream(outputLoc);
    // Get the buffer of the file.
    fs.readFile(fileLoc, function (err, data) {
        // Check if there has been an error
        if (err)
            callback(true, null);
        else {
            // Compress the buffer of the file.
            zlib.deflate(data, (err, buffer) => {
                // Check if there has been an error
                if (err)
                    callback(true, null);
                else {
                    // Write the buffer to the new file.
                    outputFile.write(buffer, 'base64');
                    // Close the file writer.
                    outputFile.end();
                    callback(false, outputLoc);
                }
            });
        }
    });
}

// Decompress the given file.
exports.decompress = function(fileLoc, callback) {
    // Create the output file for the decompressed data.
    let outputFile = fs.createWriteStream(fileLoc.replace('.gz', ''));
    // Get the buffer of the compressed file.
    fs.readFile(fileLoc, function (err, data) {
        // Check if there has been an error.
        if (err)
            callback(true);
        else {
            // Decompress the file.
            zlib.unzip(data, (err, buffer) => {
                // Check if there has been an error.
                if (err)
                    callback(true);
                else {
                    // Write the buffer to the new uncompressed file.
                    outputFile.write(buffer, 'base64');
                    // Close the file writer.
                    outputFile.end();
                    callback(false);
                }
            });
         }
    });
}

// Take the array of chunks and modify the holderID of each chunk
// depending on what user will be holding it.
exports.findHoldersForChunks = function(chunks, ownerID, callback) {
    callback(false, chunks);
}

// Split the file into chunks.
exports.fileSplitter = function(fileLoc, fileName, hashedName ,callback) {
    // TODO:  Make this based on the availible devices.
    let chunkSize = 26000  * 2;

    var parentFolder = fileLoc.replace(fileName + '.gz', '');
    var fileToSplit = parentFolder + hashedName + '.gz';

        // Async with callbacks:
    fs.copy(fileLoc, fileToSplit, err => {
        if (err)
         return console.error(err)
        console.log('success!')
        // Split the file by the correct size.
        splitFile.splitFileBySize(fileToSplit, chunkSize)
            // Successfully splitted files.
            .then((names) => {
                var chunks = [];
            
                // Go through each chunk and add it to the chunks array.
                for (var i = 0; i < names.length; i++) {
                    var split = names[i].split('/');
                    chunks.push({name: split[split.length-1], holderID: 0});
                }

                callback(false, chunks);

            })
            // Error spliting file.
            .catch((err) => {
                callback(err, "null");
        });
    })

}