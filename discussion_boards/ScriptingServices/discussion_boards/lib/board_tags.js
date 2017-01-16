/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var database = require("db/database");
var datasource = database.getDatasource();

var $log = require("logging/logger").logger;
$log.ctx = "Board DAO";

exports.listBoardTags = function(disb_id){

	$log.info('Finding DIS_BOARD_TAG entity with id[' + disb_id + ']');

	if(disb_id === undefined || disb_id === null){
		throw new Error('Illegal argument for disb_id parameter:' + disb_id);
	}

    var connection = datasource.getConnection();
    try {
        var sql = "SELECT * FROM ANN_TAG LEFT JOIN DIS_BOARD_TAG ON DISBT_ANN_ID=ANN_ID WHERE DISBT_DISB_ID=?";
     
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, disb_id);

        var resultSet = statement.executeQuery();
        var tagEntities = [];
        while (resultSet.next()) {
        	var tagEntity = {
        		ann_id: resultSet.getInt("ANN_ID"),
			    defaultLabel: resultSet.getString("ANN_DEFAULT_LABEL"),
			    uri: resultSet.getString("ANN_URI")
        	};
        	tagEntities.push(tagEntity);
        } 
        $log.info(tagEntities.length+' DIS_BOARD_TAG entities for DIS_BOARD_TAG ntity with disb_id[' + disb_id+ '] found');
        return tagEntities;
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }	
};

exports.tag = function(disb_id, tags, createOnDemand){
	var tagsLib = require('annotations/lib/tags_dao');
	var connection = datasource.getConnection();
	try{
	
		var existingBoardTagEntities = exports.listBoardTags(disb_id);
		var existingBoardTags = [];
		if(existingBoardTagEntities!==null){
			existingBoardTags = existingBoardTagEntities.map(function(tagEntity){
				return tagEntity.defaultLabel;
			});
		}
	
		for(var i=0; i < tags.length; i++){
			
			if(existingBoardTags.indexOf(tags[i])>-1)
				continue;
			
			var tagEntity = tagsLib.findByTagValue(tags[i]);
			
			if(tagEntity === null && createOnDemand){
				tagEntity = tagsLib.insert({
										defaultLabel: tags[i],
										uri: tags[i]
									});
			}
			
			if(tagEntity.ann_id){
			
				var sql =  "INSERT INTO DIS_BOARD_TAG (";
		        	sql += "DISBT_ID, DISBT_DISB_ID, DISBT_ANN_ID) "; 
		        	sql += "VALUES (?,?,?)";
		
		        var statement = connection.prepareStatement(sql);
		        
		        var j = 0;
		        var disbt_id = datasource.getSequence('DIS_BOARD_TAG_DISBT_ID').next();
		        statement.setInt(++j, disbt_id);
		        statement.setInt(++j, disb_id);        
		        statement.setString(++j, tagEntity.ann_id);        
			    
			    statement.executeUpdate();
		    	
		    	$log.info('DIS_BOARD_TAG entity inserted with id[' +  disbt_id + '] for DIS_BOARD entity with id['+disb_id+']');
			}
		}
	} catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }

};

exports.untag = function(disb_id, tags){
	var connection = datasource.getConnection();
	try{
	
		var existingBoardTagEntities = exports.listBoardTags(disb_id);
		var existingBoardTags = [];
		if(existingBoardTagEntities!==null){
			existingBoardTags = existingBoardTagEntities.map(function(tagEntity){
				return tagEntity.defaultLabel;
			});
		}
	
		for(var i=0; i < tags.length; i++){
			
			if(existingBoardTags.indexOf(tags[i])<0)
				continue;
			
			var entityToRemove = existingBoardTagEntities[existingBoardTags.indexOf(tags[i])];
			
			var sql =  "DELETE FROM DIS_BOARD_TAG ";
	        	sql += "WHERE DISBT_DISB_ID=? AND DISBT_ANN_ID=? "; 
	        	sql += "VALUES (?,?)";
	
	        var statement = connection.prepareStatement(sql);
	        
	        var j = 0;
	        statement.setInt(++j, disb_id);        
	        statement.setString(++j, entityToRemove.ann_id);        
		    
		    statement.executeUpdate();
	    	
	    	$log.info('DIS_BOARD_TAG entity with id[' +  entityToRemove.disbt_id+ '] relation to DIS_BOARD entity with id['+disb_id+'] removed');
		}
	} catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }

};

})();
