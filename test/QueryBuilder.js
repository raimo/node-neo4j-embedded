var expect = require('expect.js');
var neo4j = require('../lib/neo4j');
var async = require('async');

var database;

before(function(done) {
  this.timeout(10000);
  neo4j.setDatabaseProperties(['-Xmx4096m']);
  neo4j.connect('test/QueryBuilder.db', function(err, db) {
    database = db;
    done();
  });
});

after(function(done) {
  this.timeout(10000);
  database.shutdown();
  var exec = require('child_process').exec, child;
  child = exec('rm -rf test/QueryBuilder.db', function(err,out) {
    done();
  });
});

describe('QueryBuilder', function() {
  var homer, marge, lisa, bart, maggie;
  beforeEach(function(done) {
    var tx = database.beginTx();
    homer = database.createNode();
    homer.setProperty('name', 'Homer');
    homer.index('SIMPSONS', 'name', 'Homer');

    marge = database.createNode();
    marge.setProperty('name', 'Marge');
    marge.index('SIMPSONS', 'name', 'Marge');
    homer.createRelationshipTo(marge, 'MARRIED_WITH');

    lisa = database.createNode();
    lisa.setProperty('name', 'Lisa');
    lisa.index('SIMPSONS', 'name', 'Lisa');
    lisa.createRelationshipTo(homer, 'CHILD_OF');
    lisa.createRelationshipTo(marge, 'CHILD_OF');

    bart = database.createNode();
    bart.setProperty('name', 'Bart');
    bart.index('SIMPSONS', 'name', 'Bart');
    bart.createRelationshipTo(homer, 'CHILD_OF');
    bart.createRelationshipTo(marge, 'CHILD_OF');

    maggie = database.createNode();
    maggie.setProperty('name', 'Maggie');
    maggie.index('SIMPSONS', 'name', 'Maggie');
    maggie.createRelationshipTo(homer, 'CHILD_OF');
    maggie.createRelationshipTo(marge, 'CHILD_OF');

    tx.success();
    tx.finish();
    done();
  });
  afterEach(function(done) {
    var tx = database.beginTx();
    async.each([homer, marge, lisa, bart, maggie], function(node, done) {
      try {
        var rels = node.getRelationships();
        for(var i = 0; i < rels.length; i++) rels[i].delete();
        node.delete();
      }
      catch(e) {}
      finally {
        done();
      }
    }, function() {
      tx.success();
      try {
        tx.finish();
      }
      catch(e) {}
      done();
    });
  });
  it('should execute a simple query', function(done) {
    var tx = database.beginTx();
    var query = database.queryBuilder();
    expect(query).to.be.an('object');
    query.startAt({n: 'node:SIMPSONS("*: *")'});
    query.returns('n');
    query.execute(function(err, result, total) {
      expect(err).to.be(null);
      expect(result).to.be.an('array');
      tx.success();
      tx.finish();
      done();
    });
  });
  it('should find lisa\'s parents', function(done) {
    var query = database.queryBuilder();
    query.startAt({lisa: 'node:SIMPSONS({search})'});
    query.match('(lisa)-[:CHILD_OF]->(parent)');
    query.return('parent');
    query.execute({search: "name: Lisa"}, function(err, results, total) {
      expect(err).to.be(null);
      expect(results.length).to.be(2);
      query.getCount({search: "name: Lisa"}, function(err, total) {
        expect(err).to.be(null);
        expect(total).to.be('2');
        done();
      });
    });
  });
  it('should return a correct formatted WITH query', function() {
    var query = database.queryBuilder();
    query.match('(s:Simpsons)');
    query.orderBy({field: 's.name', dir: 'ASC'});
    query.limit(1, 10);
    query.return('s');
    var subquery = query.with();
    subquery.match('(s)-[:CHILD_OF]->(parent)');
    subquery.orderBy({field: 'parent.name', dir: 'ASC'});
    subquery.limit(1, 20);
    subquery.return('s, parent');
    var subquery2 = subquery.with();
    subquery2.where('id(parent) = 1');
    subquery2.return('s');
    expect(query.buildQuery()).to.be('MATCH (s:Simpsons) WITH s ORDER BY s.name ASC SKIP 1 LIMIT 10 MATCH (s)-[:CHILD_OF]->(parent) WITH s, parent ORDER BY parent.name ASC SKIP 1 LIMIT 20 WHERE id(parent) = 1 RETURN s');
  });
  it('should escape special characters for lucene', function() {
    var query = database.queryBuilder();
    expect(query.escape('AND OR')).to.be('\\AND\\ \\OR');
  });
  it('should delete marge', function(done) {
    var query = database.queryBuilder();
    query.startAt({marge: 'node:SIMPSONS({search})'});
    query.match('marge-[r]-x')
    query.delete('r, marge');
    query.execute({search: "name: Marge"}, done);
  });
});