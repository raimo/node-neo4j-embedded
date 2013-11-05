var expect = require('expect.js');
var neo4j = require('../lib/neo4j');
var async = require('async');

var database;

before(function(done) {
  this.timeout(10000);
  neo4j.setDatabaseProperties(['-Xmx4096m']);
  neo4j.connect('test/GraphDatabase.db', function(err, db) {
    database = db;
    done(err);
  });
});

after(function(done) {
  database.shutdown();
  var exec = require('child_process').exec, child;
  child = exec('rm -rf test/GraphDatabase.db', function(err,out) {
    done();
  });
});

describe('GraphDatabase', function() {
  it('connect', function() {
    expect(database.isConnected).to.be(true);
  });
  it('createNode', function() {
    var tx = database.beginTx(),
        node = database.createNode();

    expect(node.getId()).to.be.an('string');
    expect(node.getId()).to.be('1');
    node.delete();
    tx.success();
    tx.finish();
  });
  it('getNodeById', function() {
    var tx = database.beginTx();
    expect(database.getNodeById(0)).to.be.an('object');
    expect(database.getNodeById(0).getId()).to.be('0');
    try {database.getNodeById(100000); expect(true).to.be(false);} catch(e) {}
    tx.success();
    tx.finish();
  });
  it('transaction', function(done) {
    database.transaction(function(finish) {
      var node = database.createNode('LABEL');
      expect(node.hasLabel('LABEL')).to.be(true);
      finish(null, true);
    }, function(err, success) {
      expect(err).to.be(null);
      expect(success).to.be(true);
      done();
    });
  });
  it('transaction error', function(done) {
    database.transaction(function(success) {
      var e = null;
      try {
        var node = database.createNode('LABEL');
        expect(node.hasLabel('LABEL')).to.be(true);
        var x = database.getNodeById(1000);
      }
      catch(_e) {
        e = _e;
        expect(e).to.be.an('object');
      }
      finally {
        success(e, typeof e === 'undefined');
      }
    }, function(err, success) {
      expect(err).to.be.an('object');
      expect(success).to.be(false);
      done();
    });
  });
});
describe('GraphDatabase#Cypher', function() {
  var homer, marge, rel;

  beforeEach(function(done) {
    database.transaction(function(success) {
      homer = database.createNode(),
      marge = database.createNode();

      homer.setProperty('name', 'Homer Simpson');
      marge.setProperty('name', 'Marge Simpson');
      rel = homer.createRelationshipTo(marge, 'MARRIED_WITH');
      success();
    }, done)
  });
  afterEach(function(done) {
    database.transaction(function(success) {
      rel.delete();
      homer.delete();
      marge.delete();
      success();
    }, done);
  });

  it('query', function(done) {
    this.timeout(10000);
    database.query('START man=node(2) MATCH (man)-[rel:MARRIED_WITH]->(woman) RETURN man, rel, ID(woman) as woman_id, woman.name as woman_name', function(err, result) {
      try {
        expect(err).to.be(null);
        expect(result).to.be.an('array');
        expect(result[0]).to.be.an('object');
        expect(result[0].man).to.be.an('object');
        expect(result[0].man.getId()).to.be('2');
        expect(result[0].rel).to.be.an('object');
        expect(result[0].rel.getStartNode().getId()).to.be(result[0].man.getId());
        expect(result[0].rel.getType()).to.be('MARRIED_WITH');
        expect(result[0].woman_id.longValue).to.be('3');
        expect(result[0].woman_name).to.be('Marge Simpson');
      }
      catch(e) {}
      done();
    });
  });

  it('query (promise)', function(done) {
    var results = database.query('START man=node({id}) MATCH (man)-[rel:MARRIED_WITH]->(woman) RETURN man, rel, ID(woman) as woman_id, woman.name as woman_name', {id: 2});
    results.then(function(result) {
      try {
        expect(result).to.be.an('array');
        expect(result[0]).to.be.an('object');
        expect(result[0].man).to.be.an('object');
        expect(result[0].man.getId()).to.be('2');
        expect(result[0].rel).to.be.an('object');
        expect(result[0].rel.getStartNode().getId()).to.be(result[0].man.getId());
        expect(result[0].rel.getType()).to.be('MARRIED_WITH');
        expect(result[0].woman_id.longValue).to.be('3');
        expect(result[0].woman_name).to.be('Marge Simpson');
      }
      catch(e) {}
      done();
    }, done);
  });

  it('query with params', function(done) {
    database.query('START man=node({search}) MATCH (man)-[rel:MARRIED_WITH]->(woman) RETURN man, rel, ID(woman) as woman_id, woman.name as woman_name', {search: homer}, function(err, result) {
      try {
        expect(err).to.be(null);
        expect(result).to.be.an('array');
      }
      catch(e) {}
      done();
    });
  });

  it('query collection', function(done) {
    database.query('START n=node(*) RETURN COLLECT(n) as ns', function(err, result) {
      try {
        expect(err).to.be(null);
        expect(result).to.be.an('array');
        expect(result[0].ns).to.be.an('array');
        expect(result[0].ns[0]).to.be.an('object');
        expect(result[0].ns[0].getId()).to.be('0');
      }
      catch(e) {}
      done();
    });
  });
});