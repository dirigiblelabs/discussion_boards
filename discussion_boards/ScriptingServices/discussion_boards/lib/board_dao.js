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
	optional: ["shortText", "description", "publishTime", "lastModifiedTime", "status", "user"]
};

var $log = require("logging/logger").logger;
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
        sql += "DISB_ID, DISB_SHORT_TEXT, DISB_DESCRIPTION, DISB_USER, DISB_PUBLISH_TIME, DISB_LASTMODIFIED_TIME, DISB_STATUS) "; 
        sql += "VALUES (?,?,?,?,?,?,?)";

        var statement = connection.prepareStatement(sql);
        
        var i = 0;
        entity.disb_id = datasource.getSequence('DIS_BOARD_DISB_ID').next();
        statement.setInt(++i,  entity.disb_id);
        statement.setString(++i, entity.shortText);        
        statement.setString(++i, entity.description);

        //TODO: move to frontend svc
        entity.user = userLib.getName();
        
        statement.setString(++i, entity.user);
        
		entity.publishTime = Date.now();
        statement.setLong(++i, entity.publishTime);
       	entity.lastModifiedTime = entity.publishTime;
       	statement.setLong(++i, entity.lastModifiedTime);

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
				   var dependentItemEntities = commentsLib.findDiscussionPosts(entity.disb_id, false);
				   if(dependentItemEntities) {
				   	 entity[itemsEntitySetName] = dependentItemEntities;
			   	   }
			   	   var currentUser = userLib.getName();
			   	   var userVote = exports.getVote(id, currentUser);
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

exports.getComments = function(boardId, isFlat){
	return commentsLib.findDiscussionPosts(boardId, isFlat);
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
			   var userVote = exports.getVote(entity.disb_id, currentUser);
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
    entity.user = resultSet.getString("IDMU_UNAME");
   	entity.user_pic = resultSet.getString("IDMU_PIC");
   	entity.status = resultSet.getString("DISB_STATUS");
    entity.visits = resultSet.getString("DISB_VISITS");
    
    entity.publishTime = resultSet.getLong("DISB_PUBLISH_TIME");
    entity.publishTime = new Date(entity.publishTime).toISOString();
    
    entity.lastModifiedTime = resultSet.getLong("DISB_LASTMODIFIED_TIME");    
    if(entity.lastModifiedTime!==null)
    	entity.lastModifiedTime = new Date(entity.lastModifiedTime).toISOString();
    
	entity.latestDiscussionUpdateTime = resultSet.getLong("LATEST_UPDATE_TIME");
    if(entity.latestDiscussionUpdateTime!==null && entity.latestDiscussionUpdateTime>0)
    	entity.latestDiscussionUpdateTime = new Date(entity.latestDiscussionUpdateTime).toISOString();    
    
    entity.repliesCount = resultSet.getInt("REPLIES");  
    entity.participantsCount = resultSet.getInt("PARTICIPANTS");      
    entity.totalVotes = resultSet.getInt("TOTAL_VOTES");    
    entity.upvotes = resultSet.getInt("UPVOTES");
    entity.downvotes = resultSet.getInt("DOWNVOTES");        
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
        sql += "DISV_ID, DISV_DISB_ID, DISV_USER, DISV_VOTE) "; 
        sql += "VALUES (?,?,?,?)";

        var statement = connection.prepareStatement(sql);
        
        var i = 0;
        var disv_id = datasource.getSequence('DIS_BOARD_VOTE_DISV_ID').next();
        statement.setInt(++i, disv_id);
        statement.setInt(++i, disb_id);        
        statement.setString(++i, user);        
        statement.setShort(++i, vote);
	    
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
	
	if(entity.publishTime){
		persistentItem.publishTime = new Date(entity.publishTime).getTime();
	} 
	if(entity.latestpublishTime){
		persistentItem.latestpublishTime = new Date(entity.latestpublishTime).getTime();
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
        sql += " SET DISB_SHORT_TEXT=?, DISB_DESCRIPTION=?, DISB_USER=?, DISB_LASTMODIFIED_TIME=?, DISB_STATUS=?"; 
        sql += " WHERE DISB_ID = ?";
        var statement = connection.prepareStatement(sql);
        var i = 0;
        statement.setString(++i, entity.shortText);        
        statement.setString(++i, entity.description);
        statement.setString(++i, entity.user);
        statement.setLong(++i, Date.now());
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

exports.visit = function(disb_id){
	console.info('visit recording')
	var connection = datasource.getConnection();
    try {
    
        var sql = "UPDATE DIS_BOARD";
        sql += " SET DISB_VISITS=DISB_VISITS+1"; 
        sql += " WHERE DISB_ID = ?";
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, disb_id);        
        statement.executeUpdate();

        return this;
        
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

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
