/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var database = require("db/database");
var datasource = database.getDatasource();

var $log = require("logging/logger").logger;
$log.ctx = "Board DAO";

exports.getVote = function(disb_id, user){

	$log.info('Getting a user['+user+'] vote for DIS_BOARD entity with disb_id['+disb_id+']');

	if(disb_id === undefined || disb_id === null){
		throw new Error('Illegal argument for disb_id parameter:' + disb_id);
	}
	
	if(user === undefined || user === null){
		throw new Error('Illegal argument for user parameter:' + user);
	}	

    var connection = datasource.getConnection();
    var vote = 0;
    try {
        var sql = "SELECT * FROM DIS_BOARD_VOTE WHERE DISV_DISB_ID=? AND DISV_USER=?";
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, disb_id);
        statement.setString(2, user);
        
        var resultSet = statement.executeQuery();
        if (resultSet.next()) {
            vote = resultSet.getInt("DISV_VOTE");
			if(vote!==0){
            	$log.info('Vote for DIS_BOARD entity with with id[' + disb_id+ '] found');
        	}
        } 
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
	
	return vote;
};

exports.vote = function(disb_id, user, vote){
	console.info("Saving user["+user+"] vote["+vote+"] for idea["+disb_id+"]");
	if(vote===0 || vote === undefined)
		throw Error('Illegal Argument: vote cannot be 0 or undefined');

	var previousVote = exports.getVote(disb_id, user);

	var connection = datasource.getConnection();
    try {
    	var statement, sql;
    	if(previousVote === undefined || previousVote === null || previousVote === 0){
    		//Operations is INSERT
	        sql = "INSERT INTO DIS_BOARD_VOTE (DISV_ID, DISV_DISB_ID, DISV_USER, DISV_VOTE) VALUES (?,?,?,?)";
	        statement = connection.prepareStatement(sql);
	        
	        var i = 0;
	        var disv_id = datasource.getSequence('DIS_BOARD_VOTE_DISV_ID').next();
	        statement.setInt(++i, disv_id);
	        statement.setInt(++i, disb_id);
	        statement.setString(++i, user);        
	        statement.setShort(++i, vote);	        
		} else {
    		//Operations is UPDATE
	        sql = "UPDATE DIS_BOARD_VOTE SET DISV_VOTE=? WHERE DISV_DISB_ID=? AND DISV_USER=?";
	        statement = connection.prepareStatement(sql);
	        
	        var i = 0;
	       	statement.setShort(++i, vote);
	        statement.setInt(++i, disb_id);
	        statement.setString(++i, user);        
		}
	    
	    statement.executeUpdate();
    	
    	$log.info('DIS_BOARD_VOTE entity inserted with id[' +  disv_id + '] for DIS_BOARD entity with id['+disb_id+']');

        return disv_id;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    } 
};

})();
