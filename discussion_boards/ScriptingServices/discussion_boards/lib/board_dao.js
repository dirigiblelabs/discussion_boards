/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var database = require("db/database");
var commentsLib = require("discussion_boards/lib/comment_dao");
var userLib = require("net/http/user");

var datasource = database.getDatasource();

var itemsEntitySetName = "comments";

var persistentProperties = {
	mandatory: ["disb_id"],
	optional: ["shortText", "description", "publishDate", "status", "user"]
};

var $log = require("ideas_forge/lib/logger").logger;
$log.ctx = "Board DAO";

// Parse JSON entity into SQL and insert in db. Returns the new record id.
exports.insert = function(entity, cascaded) {

	$log.info('Inserting DIS_BOARD entity cascaded['+cascaded+']');

	if(entity === undefined || entity === null){
		throw new Error('Illegal argument: entity is ' + entity);
	}
	
	for(var i = 0; i< persistentProperties.mandatory.length; i++){
		var propName = persistentProperties.mandatory[i];
		if(propName==='disb_id')
			continue;//Skip validaiton check for id. It's epxected to be null on insert.
		var propValue = entity[propName];
		if(propValue === undefined || propValue === null){
			throw new Error('Illegal ' + propName + ' attribute value in DIS_BOARD entity for insert: ' + propValue);
		}
	}

	if(cascaded === undefined || cascaded === null){
		cascaded = false;
	}

    entity = createSQLEntity(entity);

    var connection = datasource.getConnection();
    try {
        var sql = "INSERT INTO DIS_BOARD (";
        sql += "DISB_ID, DISB_SHORT_TEXT, DISB_DESCRIPTION, DISB_USER, DISB_PUBLISH_DATE, DISB_STATUS) "; 
        sql += "VALUES (?,?,?,?,?,?)";

        var statement = connection.prepareStatement(sql);
        
        var i = 0;
        entity.disb_id = datasource.getSequence('DIS_BOARD_DISB_ID').next();
        statement.setInt(++i,  entity.disb_id);
        statement.setString(++i, entity.shortText);        
        statement.setString(++i, entity.description);

        //TODO: move to frontend svc
        entity.user = userLib.getName();
        
        statement.setString(++i, entity.user);
        
        /* TODO: */
		entity.publish_date = new Date().toString();
        statement.setString(++i, entity.publish_date);

        statement.setString(++i, entity.status);//FIXME: use codes instead        
        
        statement.executeUpdate();

		if(cascaded){
			if(entity[itemsEntitySetName] && entity[itemsEntitySetName].length > 0){
	        	for(var j=0; j<entity[itemsEntitySetName].length; j++){
	        		var item = entity[itemsEntitySetName][j];
	        		item.boi_boh_name = entity.boh_name;
					commentsLib.insert(item);        				
	    		}
	    	}
		}

        $log.info('DIS_BOARD entity inserted with id[' +  entity.disb_id + ']');

        return entity.disb_id;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

// Reads a single entity by id, parsed into JSON object 
exports.find = function(id, expanded) {

	$log.info('Finding DIS_BOARD entity with id[' + id + ']');

	if(id === undefined || id === null){
		throw new Error('Illegal argument for id parameter:' + id);
	}

    var connection = datasource.getConnection();
    try {
        var entity;
        var sql = "SELECT * FROM DIS_BOARD_STATS WHERE " + exports.pkToSQL();
     
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, id);

        var resultSet = statement.executeQuery();
        if (resultSet.next()) {
        	entity = createEntity(resultSet);
			if(entity){
            	$log.info('DIS_BOARD_STATS entity with id[' + id + '] found');
				if(expanded !== null && expanded!==undefined){
				   var dependentItemEntities = commentsLib.list(entity.disb_id, null, null, null, null);
				   if(dependentItemEntities) {
				   	 entity[itemsEntitySetName] = dependentItemEntities;
			   	   }
			   	   var currentUser = userLib.getName();
			   	   var userVote = exports.userVoteForIdea(id, currentUser);
			   	   entity.currentUserVote = userVote;
				}            	
        	}
        } 
        return entity;
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

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
        var sql = "SELECT * FROM DIS_BOARD_VOTE WHERE IDFV_DISB_ID=? AND IDFV_USER=?";
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, disb_id);
        statement.setString(2, user);
        
        var resultSet = statement.executeQuery();
        if (resultSet.next()) {
            vote = resultSet.getInt("IDFV_VOTE");
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

// Read all entities, parse and return them as an array of JSON objets
exports.list = function(limit, offset, sort, order, expanded, entityName) {

	$log.info('Listing DIS_BOARD_STATS entity collection expanded['+expanded+'] with list operators: limit['+limit+'], offset['+offset+'], sort['+sort+'], order['+order+'], entityName['+entityName+']');
	
    var connection = datasource.getConnection();
    try {
        var entities = [];
        var sql = "SELECT";
        if (limit !== null && offset !== null) {
            sql += " " + datasource.getPaging().genTopAndStart(limit, offset);
        }
        sql += " * FROM DIS_BOARD_STATS";
        if (entityName !== undefined && entityName !== null) {
        	sql += " WHERE DISB_SHORT_TEXT LIKE '" + entityName + "%%'";
    	}
        if (sort !== undefined && sort !== null) {
            sql += " ORDER BY " + sort;
        }
        if ((sort !== undefined && sort !== null) && (sort !== undefined && order !== null)) {
            sql += " " + order;
        }
        if ((limit !== undefined && limit !== null) && (offset !== undefined && offset !== null)) {
            sql += " " + datasource.getPaging().genLimitAndOffset(limit, offset);
        }

        var statement = connection.prepareStatement(sql);
        var resultSet = statement.executeQuery();
        while (resultSet.next()) {
        	var entity = createEntity(resultSet);
        	if(expanded !== null && expanded!==undefined){
			   var dependentItemEntities = commentsLib.list(entity.disb_id, null, null, null, null);
			   if(dependentItemEntities) {
			   	 entity[itemsEntitySetName] = dependentItemEntities;
		   	   }
		   	   var currentUser = userLib.getName();
			   var userVote = exports.userVoteForIdea(entity.disb_id, currentUser);
			   entity.currentUserVote = userVote;
			}
            entities.push(entity);
        }
        
        $log.info('' + entities.length +' DIS_BOARD_STATS entities found');
        
        return entities;
    }  catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

//create entity as JSON object from ResultSet current Row
function createEntity(resultSet) {
    var entity = {};
	entity.disb_id = resultSet.getInt("DISB_ID");
    entity.shortText = resultSet.getString("DISB_SHORT_TEXT");	
    entity.description = resultSet.getString("DISB_DESCRIPTION");
    entity.user = resultSet.getString("DISB_USER");
    entity.publishDate = resultSet.getString("DISB_PUBLISH_DATE"); 
    entity.status = resultSet.getString("DISB_STATUS");
    entity.latestPublishDate = resultSet.getString("LATEST_PUBLISH_DATE");    
    entity.repliesCount = resultSet.getInt("REPLIES");  
    entity.participantsCount = resultSet.getInt("PARTICIPANTS");      
    entity.totalVotes = resultSet.getInt("TOTAL_VOTES");    
    entity.rating = resultSet.getInt("RATING");  
	for(var key in Object.keys(entity)){
		if(entity[key] === null)
			entity[key] = undefined;
	}	
    entity.editable = entity.user === userLib.getName();
    $log.info("Transformation from DB JSON object finished");
    return entity;
}

exports.vote = function(disb_id, user, vote){
	console.info("Saving user["+user+"] vote["+vote+"] for idea["+disb_id+"]");
	if(vote===0 || vote === undefined)
		throw Error('Illegal Argument: vote cannot be 0 or undefined');

	var connection = datasource.getConnection();
    try {
        var sql = "INSERT INTO DIS_BOARD_VOTE (";
        sql += "IDFV_ID, IDFV_DISB_ID, IDFV_USER, IDFV_VOTE) "; 
        sql += "VALUES (?,?,?,?)";

        var statement = connection.prepareStatement(sql);
        
        var i = 0;
        var idfv_id = datasource.getSequence('DIS_BOARD_VOTE_IDFV_ID').next();
        statement.setInt(++i, idfv_id);
        statement.setInt(++i, disb_id);        
        statement.setString(++i, user);        
        statement.setShort(++i, vote);
	    
	    statement.executeUpdate();
    	
    	$log.info('DIS_BOARD_VOTE entity inserted with id[' +  idfv_id + '] for DIS_BOARD entity with id['+disb_id+']');

        return idfv_id;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    } 
};

//Prepare a JSON object for insert into DB
function createSQLEntity(entity) {
	var persistentItem = {};
	for(var i=0;i<persistentProperties.mandatory.length;i++){
		persistentItem[persistentProperties.mandatory[i]] = entity[persistentProperties.mandatory[i]];
	}
	for(var i=0;i<persistentProperties.optional.length;i++){
		if(entity[persistentProperties.optional[i]] !== undefined){
			persistentItem[persistentProperties.optional[i]] = entity[persistentProperties.optional[i]];
		} else {
			persistentItem[persistentProperties.optional[i]] = null;
		}
	}	
	$log.info("Transformation to DB JSON object finished");
	return persistentItem;
}

// update entity from a JSON object. Returns the id of the updated entity.
exports.update = function(entity) {

	$log.info('Updating DIS_BOARD entity with id[' + entity!==undefined?entity.disb_id:entity + ']');

	if(entity === undefined || entity === null){
		throw new Error('Illegal argument: entity is ' + entity);
	}	
	
	for(var i = 0; i< persistentProperties.mandatory.length; i++){
		var propName = persistentProperties.mandatory[i];
		var propValue = entity[propName];
		if(propValue === undefined || propValue === null){
			throw new Error('Illegal ' + propName + ' attribute value in DIS_BOARD entity for update: ' + propValue);
		}
	}
	
	entity = createSQLEntity(entity);
	
    var connection = datasource.getConnection();
    try {
    
        var sql = "UPDATE DIS_BOARD";
        sql += " SET DISB_SHORT_TEXT=?, DISB_DESCRIPTION=?, DISB_USER=?, DISB_PUBLISH_DATE=?, DISB_STATUS=?"; 
        sql += " WHERE DISB_ID = ?";
        var statement = connection.prepareStatement(sql);
        var i = 0;
        statement.setString(++i, entity.shortText);        
        statement.setString(++i, entity.description);
        statement.setString(++i, entity.user);
        statement.setString(++i, entity.status);
        statement.setString(++i, entity.publishDate);
        statement.setString(++i, entity.status);        
        var id = entity.disb_id;
        statement.setInt(++i, id);
        statement.executeUpdate();
            
        $log.info('DIS_BOARD entity with disb_id[' + id + '] updated');
        
        return this;
        
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

// delete entity by id. Returns the id of the deleted entity.
exports.remove = function(id, cascaded) {

	$log.info('Deleting DIS_BOARD entity with id[' + id + '], cascaded['+cascaded+']');

    var connection = datasource.getConnection();
    try {
    
    	var sql = "DELETE FROM DIS_BOARD";
    	
    	if(id !== null){
    	 	sql += " WHERE " + exports.pkToSQL();
    	 	if(id.constructor === Array){
    	 		sql += "IN ("+id.join(',')+")";
    	 	} else {
    	 		" = "  + id;
    	 	}
		}

        var statement = connection.prepareStatement(sql);
        if(id!==null && id.constructor !== Array){
        	statement.setString(1, id);
        }
        statement.executeUpdate();
        
		if(cascaded===true && id!==null){
			var dependentItems = commentsLib.list(id);
			for(var i = 0; i < dependentItems.length; i++) {
        		commentsLib.remove(dependentItems[i].boi_id);
			}
		}        
        
        $log.info('DIS_BOARD entity with disb_id[' + id + '] deleted');                
        
        return this;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

exports.count = function() {

	$log.info('Counting DIS_BOARD entities');

    var count = 0;
    var connection = datasource.getConnection();
    try {
    	var sql = 'SELECT COUNT(*) FROM DIS_BOARD';
        var statement = connection.prepareStatement(sql);
        var rs = statement.executeQuery();
        if (rs.next()) {
            count = rs.getInt(1);
        }
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
    
    $log.info('' + count + ' DIS_BOARD entities counted');

    return count;
};

exports.getPrimaryKeys = function() {
    var result = [];
    var i = 0;
    result[i++] = 'DISB_ID';
    if (result === 0) {
        throw new Error("There is no primary key");
    } else if(result.length > 1) {
        throw new Error("More than one Primary Key is not supported.");
    }
    return result;
};

exports.getPrimaryKey = function() {
	return exports.getPrimaryKeys()[0].toLowerCase();
};

exports.pkToSQL = function() {
    var pks = exports.getPrimaryKeys();
    return pks[0] + " = ?";
};

})();
