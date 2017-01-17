/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var database = require("db/database");
var datasource = database.getDatasource();

var $log = require("logging/logger").logger;
$log.ctx = "Board DAO";

exports.getVote = function(id, user){

	$log.info('Finging USR_USER['+user+'] vote for DIS_BOARD['+id+'] entity');

	if(id === undefined || id === null){
		throw new Error('Illegal argument for id parameter:' + id);
	}
	
	if(user === undefined || user === null){
		throw new Error('Illegal argument for user parameter:' + user);
	}	

    var connection = datasource.getConnection();
    var vote = 0;
    try {
        var sql = "SELECT * FROM DIS_BOARD_VOTE WHERE DISV_DISB_ID=? AND DISV_USER=?";
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, id);
        statement.setString(2, user);
        
        var resultSet = statement.executeQuery();
        if (resultSet.next()) {
            vote = resultSet.getInt("DISV_VOTE");
			if(vote!==0){
            	$log.info('USR_USER['+user+'] vote for DIS_BOARD['+id+'] entity found');
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

exports.vote = function(id, user, vote){
	$log.info("Recording user["+user+"] vote["+vote+"] for DIS_BOARD["+id+"]");
	if(vote===0 || vote === undefined)
		throw Error('Illegal Argument: vote cannot be 0 or undefined');

	var previousVote = exports.getVote(id, user);

	var connection = datasource.getConnection();
    try {
    	var statement, sql, isInsert;
    	if(previousVote === undefined || previousVote === null || previousVote === 0){
    		//Operations is INSERT
    		isInsert = true; 
    		$log.info("Inserting DIS_BOARD_VOTE relation between DIS_BOARD["+id+"] and USR_USER["+user+"]");
	        sql = "INSERT INTO DIS_BOARD_VOTE (DISV_ID, DISV_DISB_ID, DISV_USER, DISV_VOTE) VALUES (?,?,?,?)";
	        statement = connection.prepareStatement(sql);
	        
	        var i = 0;
	        var voteId = datasource.getSequence('DIS_BOARD_VOTE_DISV_ID').next();
	        statement.setInt(++i, voteId);
	        statement.setInt(++i, id);
	        statement.setString(++i, user);        
	        statement.setShort(++i, vote);	        
		} else {
    		//Operations is UPDATE
			isInsert = false;
			$log.info("Updating DIS_BOARD_VOTE relation between DIS_BOARD["+id+"] and USR_USER["+user+"]");
	        sql = "UPDATE DIS_BOARD_VOTE SET DISV_VOTE=? WHERE DISV_DISB_ID=? AND DISV_USER=?";
	        statement = connection.prepareStatement(sql);
	        
	        var i = 0;
	       	statement.setShort(++i, vote);
	        statement.setInt(++i, id);
	        statement.setString(++i, user);        
		}
	    
	    statement.executeUpdate();
	    
	    var msgOperationResult = isInsert?"inserted":"updated";
	    $log.info('DIS_BOARD_VOTE[' + voteId + '] entity relation between DIS_BOARD[' + id + '] and USR_USER[' + user + '] ' + msgOperationResult);
	    
        return voteId;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    } 
};

})();
