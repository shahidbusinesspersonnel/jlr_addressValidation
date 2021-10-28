let path = require('path');
var logger = require('logger').createLogger();
var check = require(path.join(__dirname, '..', 'service', 'util', 'checkValidObject'));
let ocr = require(path.join(__dirname, 'ocr.controller'));
var gpsService = require(path.join(__dirname, '..', 'service', 'util', 'gpsService'));
var requestData = require('request');
let config = require(path.join(__dirname, '..', 'configs', 'appConfig'));
var async = require('async');
const { CallTracker } = require('assert');
var similarityCheckService = require(path.join(__dirname, '..', 'service', 'util', 'findStringSimilarity'));
var parsingService = require(path.join(__dirname, '..', 'service', 'util', 'parsingService'));
const fs = require('fs');

// var firebase        = require('firebase');

// import { getFirestore, collection, getDocs } from 'firebase/firestore/lite';


exports.jlrocrtest_test = function (req, res) {
	parsingService.extractandPrepareReaminingData(req.body.data, function (result) {
		res.send(result);
	});
}

exports.jlrOcrExtract = function (req, res, next) {
	try {
		var filesData = req.files;
		let bodyData = req.body;
		console.log('bodyData=', bodyData);
		// let fetch_VinNo = req.body['fetch_VinNo'];
		// let fetch_registrationNumber = req.body['fetch_registrationNumber'];
		// let fetch_name = req.body['fetch_name'];
		// let fetch_address = req.body['fetch_address'];

		// let image_url = filesData[0]["originalname"];
		console.log('bodyData=', filesData[0]["filename"])
		ocr.googleVisionJLR(filesData[0]["filename"], function (result_ocr) {
			res.send(result_ocr);
			// break;
		});
	} catch (error) {
		console.log('err', error);
	}
}

exports.addressValidator = function (req, res) {
	let validateCompanyPresence_resp = {};
	try {
		console.log("Request input=", req.body);

		let raw_sourceAddress = req.body.sourceAddress;
		let raw_destAddress = req.body.destAddress;
		//Get the source address standardized using Google Service

		let sourceAddress = {};
		let destinationAddress = {};
		sourceAddress.zipCode = raw_sourceAddress["source_zip"];;
		sourceAddress.Address_Ln_1 = raw_sourceAddress["Address_Ln_1"];
		sourceAddress.Country = raw_sourceAddress["source_Country"];

		destinationAddress.zipCode = raw_destAddress["dest_zip"];
		destinationAddress.Address_Ln_1 = raw_destAddress["dest_Address_Ln_1"];
		destinationAddress.Country = raw_destAddress["dest_Country"];
		console.log('Input Source Address=', sourceAddress);
		gpsService.getFormattedAddress(sourceAddress, function (result_FormattedSource) {
			console.log('result_FormattedSource', result_FormattedSource);
			if (result_FormattedSource['status'] == 'SUCCESS') {
				console.log('Input Destination Address=', destinationAddress);
				gpsService.getFormattedAddress(destinationAddress, function (result_FormattedDest) {
					console.log('result_FormattedDest=', result_FormattedDest);
					if (result_FormattedDest['status'] == 'SUCCESS') {
						//Get comparisn scrore agaist standardize addresses
						similarityCheckService.findSimilarityBetweeString(result_FormattedSource.formattedAddress, result_FormattedDest.formattedAddress, function (result) {
							if (result["status"] == "SUCCESS") {
								validateCompanyPresence_resp.status = 'SUCCESS';
								validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'SUCCESS';
								validateCompanyPresence_resp.standard_source_addr = result_FormattedSource;
								validateCompanyPresence_resp.standard_dest_addr = result_FormattedDest;
								validateCompanyPresence_resp.comparisn_result = result['data'];
								res.status = 200;
								res.send(validateCompanyPresence_resp);
							}
							else {
								//Get comparisn scrore agaist NON-standardize addresses
								similarityCheckService.findSimilarityBetweeString(sourceAddress.Address_Ln_1, destinationAddress.dest_Address_Ln_1, function (result) {
									if (result["status"] == "SUCCESS") {
										validateCompanyPresence_resp.status = 'SUCCESS';
										validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'FAILED';
										validateCompanyPresence_resp.comparisn_result = result['data'];
										res.status = 200;
										res.send(validateCompanyPresence_resp);
									}
									else {
										validateCompanyPresence_resp.status = 'ERROR';
										validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'FAILED';
										res.status = 500;
										res.send(validateCompanyPresence_resp);
									}

								});
							}
						});
					}
					else {
						//Get comparisn scrore agaist NON-standardize addresses
						similarityCheckService.findSimilarityBetweeString(sourceAddress.Address_Ln_1, destinationAddress.dest_Address_Ln_1, function (result) {
							if (result["status"] == "SUCCESS") {
								validateCompanyPresence_resp.status = 'SUCCESS';
								validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'FAILED';
								validateCompanyPresence_resp.comparisn_result = result['data'];
								res.send(validateCompanyPresence_resp);
							}
							else {
								validateCompanyPresence_resp.status = 'ERROR';
								validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'FAILED';
								res.send(validateCompanyPresence_resp);
							}

						});
					}
				});
			}
			else {
				//Get comparisn scrore agaist NON-standardize addresses
				similarityCheckService.findSimilarityBetweeString(sourceAddress.Address_Ln_1, destinationAddress.dest_Address_Ln_1, function (result) {
					if (result["status"] == "SUCCESS") {
						validateCompanyPresence_resp.status = 'SUCCESS';
						validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'FAILED';
						validateCompanyPresence_resp.comparisn_result = result['data'];
						res.status = 200;
						res.send(validateCompanyPresence_resp);
					}
					else {
						validateCompanyPresence_resp.status = 'ERROR';
						validateCompanyPresence_resp.ADDRESS_STD_STATUS = 'FAILED';
						res.status = 500;
						res.send(validateCompanyPresence_resp);
					}

				});
			}
		});

	} catch (error) {
		validateCompanyPresence_resp.status = 'ERROR';
		validateCompanyPresence_resp.data = 'Internal Server Error !!'
		res.send(validateCompanyPresence_resp);
		console.log('Error', error);
	}
}

exports.storePIIData = function (req, res) {
	encryptAndStoreData(req.body, function (result) {
		res.send(result);
	});
}


// Function to be placed as Clound Function
function encryptAndStoreData(data, callback) {

	let encryptAndStoreData_resp = {};
	try {
		encryptData(data, function (result) {
			if (result['status'] == 'SUCCESS') {
				encryptAndStoreData_resp.status = 'SUCCESS';
				console.log('159...', result);
				storeData(data['convId'], result['data'], function (result) {
					if (result['status'] == 'SUCCESS') {
						encryptAndStoreData_resp.status = 'SUCCESS';
						encryptAndStoreData_resp.data = 'Successfully encrypted and stored the data in Firebase DB';
						callback(encryptAndStoreData_resp);
					}
					else {
						encryptAndStoreData_resp.status = 'ERROR';
						encryptAndStoreData_resp.status = 'Failed to store data in Firebase DB';
						callback(encryptAndStoreData_resp);
					}
				});
			}
			else {
				encryptAndStoreData_resp.status = 'ERROR';
				encryptAndStoreData_resp.status = 'Failed to Encrypt the data';
				callback(encryptAndStoreData_resp);
			}
		});
	} catch (error) {
		encryptAndStoreData_resp.status = 'ERROR';
		encryptAndStoreData_resp.status = 'Internal Server Error';
		callback(encryptAndStoreData_resp);
	}
}

function encryptData(dataInput, callback) {
	let encryptData_resp = {};
	try {
		
		var CryptoJS = require("crypto-js");
		// shahid12345 is the secret KeyboardEvent, use a more stromg one
		var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(dataInput), 'sec12345#$%^&*').toString();
		encryptData_resp.status = 'SUCCESS';
		encryptData_resp.data = ciphertext;
		callback(encryptData_resp);

	} catch (error) {
		console.log('Error in Encryption=', error);
		encryptData_resp.status = 'ERROR';
		encryptData_resp.data = 'Internal Server Error occurred during Data Encryption !!';
		callback(encryptData_resp);
	}
}

function storeData(convId, data, callback) {
	let storeData_resp = {};
	try {
		var appInstance = require('firebase/app');
		var dbInstance       = require('firebase/database');

		var firebaseConfig = {

			// apiKey: "*******************************",
			// authDomain: "*******************************",
			// databaseURL: "*******************************"
		};
		const app = appInstance.initializeApp(firebaseConfig);
		const db = dbInstance.getDatabase(app);
		dbInstance.set(dbInstance.ref(db, 'user_pii/' + convId), {data:data	});
		storeData_resp.status = 'SUCCESS';
		callback(storeData_resp);

			
	} catch (error) {
		console.log('Error occurred..', error);
		storeData_resp.status = 'SUCCESS';
		storeData_resp.data = 'Internal Server 	Error while Storing the data...';
		callback(storeData_resp);
	}
}
// /To be coded
exports.fetchencryptedPIIData = function (req, res) {
	fetchencryptedPIIData(req, function (result) {
		res.send(result);
	});
}


function fetchencryptedPIIData(req, callback){
	try {
		var appInstance = require('firebase/app');
		var dbInstance       = require('firebase/database');
		var firebaseConfig = {

			// apiKey: "*******************************",
			// authDomain: "*******************************",
			// databaseURL: "*******************************"
		};
		var convId = req.query['convId'];
		var needRawData = req.query['needRawData'];
		console.log('convId=', convId, needRawData);
		const app = appInstance.initializeApp(firebaseConfig);
		const db = dbInstance.getDatabase(app);
		let dataObj = dbInstance.ref(db, 'user_pii/' + convId);
		dbInstance.onValue(dataObj, (snapShot)=>{
			// console.log('Data=', snapShot.val());
			if(needRawData == 'true'){
				console.log('needRawData', needRawData);

				var CryptoJS = require("crypto-js");
				// Decrypt
				var bytes  = CryptoJS.AES.decrypt(snapShot.val().data, 'sec12345#$%^&*');
				var originalText = bytes.toString(CryptoJS.enc.Utf8);

				callback(originalText);
			}
			else{
				callback(snapShot.val());
			}
		});
		// dbInstance.get()
	} catch (error) {
		console.log('Error=', error);		
	}
}