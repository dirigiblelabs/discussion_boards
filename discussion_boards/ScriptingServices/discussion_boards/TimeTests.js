/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";
	
	var arester = require("arestme/arester");
	
	var Test = arester.asRestAPI();
	Test.prototype.logger.ctx = "Test Svc";
	
	//override default GET list operation handler for this resource
	Test.prototype.cfg[""].get.handler = function(context, io){
		io.response.println(new Date(1482247252309).toISOString());
	};
	
	var test = new Test();	
	
	var request = require("net/http/request");
	var response = require("net/http/response");
	
	test.service(request, response);
	
})();
