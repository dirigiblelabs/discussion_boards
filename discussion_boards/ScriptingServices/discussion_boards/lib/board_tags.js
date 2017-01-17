/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var database = require("db/database");
var datasource = database.getDatasource();

var $log = require("logging/logger").logger;
$log.ctx = "BoardTags DAO";

exports.listBoardTags = function(id){

	$log.info('Finding DIS_BOARD_TAG entities related to DIS_BOARD['+id+']');

	if(id === undefined || id === null){
		throw new Error('Illegal argument for id parameter:' + id);
	}

    var connection = datasource.getConnection();
    try {
        var sql = "SELECT * FROM ANN_TAG LEFT JOIN DIS_BOARD_TAG ON DISBT_ANN_ID=ANN_ID WHERE DISBT_DISB_ID=?";
     
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, id);

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
        $log.info(tagEntities.length+' DIS_BOARD_TAG entities related to DIS_BOARD[' + id+ '] found');
        return tagEntities;
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }	
};

exports.tag = function(id, tags, createOnDemand){
	var tagsLib = require('annotations/lib/tags_dao');
	var connection = datasource.getConnection();
	try{
	
		var existingBoardTagEntities = exports.listBoardTags(id);
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
			
			var tagId = tagEntity && tagEntity.ann_id;
			if(!tagEntity && createOnDemand){
				tagId = tagsLib.insert({
										"defaultLabel": tags[i],
										"uri": tags[i]
									});								
			}

			$log.info('Inserting DIS_BOARD_TAG entity relation between ANN_TAG['+tagId+'] entity and DIS_BOARD['+id+'] entity');
			
			var sql =  "INSERT INTO DIS_BOARD_TAG (";
	        	sql += "DISBT_ID, DISBT_DISB_ID, DISBT_ANN_ID) "; 
	        	sql += "VALUES (?,?,?)";
	
	        var statement = connection.prepareStatement(sql);
	        
	        var j = 0;
	        var disbt_id = datasource.getSequence('DIS_BOARD_TAG_DISBT_ID').next();
	        statement.setLong(++j, disbt_id);
	        statement.setInt(++j, id);        
	        statement.setLong(++j, tagId);        
		    
		    statement.executeUpdate();
	    	
	    	$log.info('DIS_BOARD_TAG[' +  disbt_id + '] entity relation for ANN_TAG['+tagId+'] and DIS_BOARD['+id+'] entity inserted');
		}
	} catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }

};

exports.untag = function(id, tags){
	$log.info('Removing DIS_BOARD_TAG entity relations to DIS_BOARD['+id+'] entity');
	var connection = datasource.getConnection();
	try{
	
		var existingBoardTagEntities = exports.listBoardTags(id);
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
	        statement.setInt(++j, id);        
	        statement.setString(++j, entityToRemove.ann_id);        
		    
		    statement.executeUpdate();
	    	
	    	$log.info('DIS_BOARD_TAG[' +  entityToRemove.disbt_id+ '] entity relation between DIS_BOARD[' + id + '] entity and ANN_TAG['+entityToRemove.ann_id+'] removed');
		}
	} catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }

};

exports.setTags = function(id, tags, createOnDemand){
	$log.info('Inserting DIS_BOARD_TAG entity relations to DIS_BOARD[' +  id+ '] entity');
	var boardTags = exports.listBoardTags(id);	
	var sql;
	try{ 
		var connection = datasource.getConnection();
		for(var i=0; i < boardTags.length; i++){
			$log.info('Removing DIS_BOARD_TAG entity relation between DIS_BOARD['+id+'] entity and ANN_TAG['+boardTags[i].ann_id+']');
			sql =  "DELETE FROM DIS_BOARD_TAG ";
	        sql += "WHERE DISBT_DISB_ID=? AND DISBT_ANN_ID=? "; 
	        var statement = connection.prepareStatement(sql);
	        var j = 0;
	        statement.setInt(++j, id);        
	        statement.setString(++j, boardTags[i].ann_id);       
		    statement.executeUpdate();
		    $log.info('DIS_BOARD_TAG entity relation between DIS_BOARD['+id+'] entity and ANN_TAG['+boardTags[i].ann_id+'] removed');
		}
		$log.info(boardTags.length + ' DIS_BOARD_TAG entity relations to DIS_BOARD_TAG[' +  id+ '] entity removed');
	} catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }		
	exports.tag(id, tags, createOnDemand);	
};

})();
