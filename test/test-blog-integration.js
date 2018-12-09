'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {blog} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return blog.insertMany(seedData);
}

// used to generate data to put in db
function generateTitle() {
  const title = [
    'Blog post 1', 'Blog post 2', 'Blog post 3', 'Blog post 4', 'Blog post 5'];
  return title[Math.floor(Math.random() * title.length)];
}

// used to generate data to put in db
function generateContent() {
  const content = ['content 1', 'content 2', 'Content 3'];
  return content[Math.floor(Math.random() * content.length)];
}


// used to generate data to put in db
function generateAuthor() {
  const authors = ['Ameila', 'Bob', 'Conor', 'Dane', 'Frank'];
  const author = authors[Math.floor(Math.random() * authors.length)];
  return {
    date: faker.first_name(),
    author: author
  };
}

// generate an object represnting a blog.
// can be used to generate seed data for db
// or request.body data
function generateBlogData() {
  return {
    title: generateTitle(),
    content: generateContent(),
    author: {
      firstName: faker.name.first_name(),
      lastName: faker.name.last_name(),
    },
    authors: [generateauthor(), generateauthor(), generateauthor()]
  };
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('blogs API resource', function() {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedBlogData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing blogs', function() {
      // strategy:
      //    1. get back all blogs returned by by GET request to `/blogs`
      //    2. prove res has right status, data type
      //    3. prove the number of blogs we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/blogs')
        .then(function(_res) {
          // so subsequent .then blocks can access response object
          res = _res;
          expect(res).to.have.status(200);
          // otherwise our db seeding didn't work
          expect(res.body.blogs).to.have.lengthOf.at.least(1);
          return blog.count();
        })
        .then(function(count) {
          expect(res.body.blogs).to.have.lengthOf(count);
        });
    });


    it('should return blogs with right fields', function() {
      // Strategy: Get back all blogs, and ensure they have expected keys

      let resblog;
      return chai.request(app)
        .get('/blogs')
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body.blogs).to.be.a('array');
          expect(res.body.blogs).to.have.lengthOf.at.least(1);

          res.body.blogs.forEach(function(blog) {
            expect(blog).to.be.a('object');
            expect(blog).to.include.keys(
              'content', 'title', 'author');
          });
          resblog = res.body.blogs[0];
          return blog.findById(resblog.id);
        })
        .then(function(blog) {

          expect(resblog.content).to.equal(blog.content);
          expect(resblog.title).to.equal(blog.title);

          expect(resblog.author).to.equal(blog.author);
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the blog we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blog', function() {

      const newblog = generateBlogData();

      return chai.request(app)
        .post('/blogs')
        .send(newblog)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'content', 'title', 'author');
          // cause Mongo should have created id on insertion
    
          expect(res.body.content).to.equal(newblog.content);
          expect(res.body.title).to.equal(newblog.title);

          expect(resblog.author).to.equal(blog.author);
          return blog.findById(res.body.id);
        })
        .then(function(blog) {
          expect(blog.content).to.equal(newblog.content);
          expect(blog.title).to.equal(newblog.title);
          expect(blog.author).to.equal(newblog.author);
        });
    });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing blog from db
    //  2. Make a PUT request to update that blog
    //  3. Prove blog returned by request contains data we sent
    //  4. Prove blog in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        content: 'futuristic fusion blogs'
      };

      return blog
        .findOne()
        .then(function(blog) {
          updateData.id = blog.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/blogs/${blog.id}`)
            .send(updateData);
        })
        .then(function(res) {
          expect(res).to.have.status(204);

          return blog.findById(updateData.id);
        })
        .then(function(blog) {
          expect(blog.name).to.equal(updateData.name);
          expect(blog.content).to.equal(updateData.content);
        });
    });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a blog
    //  2. make a DELETE request for that blog's id
    //  3. assert that response has right status code
    //  4. prove that blog with the id doesn't exist in db anymore
    it('delete a blog by id', function() {

      let blog;

      return blog
        .findOne()
        .then(function(_blog) {
          blog = _blog;
          return chai.request(app).delete(`/blogs/${blog.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return blog.findById(blog.id);
        })
        .then(function(_blog) {
          expect(_blog).to.be.null;
        });
    });
  });
});