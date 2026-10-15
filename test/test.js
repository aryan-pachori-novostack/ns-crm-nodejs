let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../app');
let should = chai.should();


chai.use(chaiHttp);

describe('create CEO/SuperAdmin user', () => {
  describe('post create CEO/SuperAdmin user', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
      it('post create CEO/SuperAdmin user', (done) => {
        chai.request(server)
            .post('/v1/user/signUpCEO').send(
				{
					"email":`neeraj.singh+${randomnumber}@novostack.com`,
					"password":"Giluj@life1",
					"name":"Neeraj Singh",
					"phone":"+919517716629"
				}
			)
            .end((err, res) => {
                res.body.meta.code.should.be.eq(201);
              done();
            });
      });
  });
  describe('create CEO/SuperAdmin user alredy exiss', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(204);
				done();
			  });
		});
	});
   });
   describe('login CEO/SuperAdmin user alredy', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('Login CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/loginCEO').send(
				  {
					email:body.email,
					password:body.password
				  }
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(200);
				done();
			  });
		});
	});
   });

   describe('login failed wrong password CEO/SuperAdmin user alredy exiss', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('Login with wrong password CEO/SuperAdmin user', () => {
	  
		it('post login CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/loginCEO').send(
				  {
					email:body.email,
					password:"1234567"
				  }
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(401);
				done();
			  });
		});
	});
   });

   describe('login failed wrong email CEO/SuperAdmin user alredy exiss', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('Login with wrong email CEO/SuperAdmin user', () => {
	  
		it('post login CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/loginCEO').send(
				  {
					email:body.email,
					password:"1234567"
				  }
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(401);
				done();
			  });
		});
	});
   });
   describe('change password user', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	let changedpassword= "abcde";
	let token;
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('Login CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/loginCEO').send(
				  {
					email:body.email,
					password:body.password
				  }
			  )
			  .end((err, res) => {
				 token = res.body.Token;
				  res.body.meta.code.should.be.eq(200);
				done();
			  });
		});
	});
	describe('Change password for user', () => {
	  
		it('Change password for user', (done) => {
		  chai.request(server)
			  .post('/v1/user/changePassword').set({ "Authorization": `${token}` }).send(
				  {
					password:changedpassword,
					confirmPassword:changedpassword
				  }
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(201);
				done();
			  });
		});
	});
   });

   describe('change password user confirm password does not match', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	let changedpassword= "abcde";
	let token;
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('Login CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/loginCEO').send(
				  {
					email:body.email,
					password:body.password
				  }
			  )
			  .end((err, res) => {
				 token = res.body.Token;
				  res.body.meta.code.should.be.eq(200);
				done();
			  });
		});
	});
	describe('Change password for user', () => {
	  
		it('Change password for user', (done) => {
		  chai.request(server)
			  .post('/v1/user/changePassword').set({ "Authorization": `${token}` }).send(
				  {
					password:changedpassword,
					confirmPassword:"12325shs"
				  }
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(401);
				done();
			  });
		});
	});
   });
   describe('add User api', () => {
	let randomnumber =  Math.floor(1000 + Math.random() * 900000); 
	let body ={
		"email":`neeraj.singh+${randomnumber}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629"
	}
	let addUserBody = {
		"parent":body.email,
		"email":`neeraj.singh+${Math.floor(1000 + Math.random() * 900000)}@novostack.com`,
		"password":"Giluj@life1",
		"name":"Neeraj Singh",
		"phone":"+919517716629",
		"role":"CRM_ADMIN"
	};
	let changedpassword= "abcde";
	let token;
	describe('post create CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/signUpCEO').send(
				  body
			  )
			  .end((err, res) => {
				done();
			  });
		});
	});
	describe('Login CEO/SuperAdmin user', () => {
	  
		it('post create CEO/SuperAdmin user', (done) => {
		  chai.request(server)
			  .post('/v1/user/loginCEO').send(
				  {
					email:body.email,
					password:body.password
				  }
			  )
			  .end((err, res) => {
				 token = res.body.Token;
				  res.body.meta.code.should.be.eq(200);
				done();
			  });
		});
	});
	describe('add User Api', () => {
	  
		it('Change password for user', (done) => {
		  chai.request(server)
			  .post('/v1/user/addUser').set({ "Authorization": `${token}` }).send(
				 addUserBody
			  )
			  .end((err, res) => {
				  res.body.meta.code.should.be.eq(201);
				done();
			  });
		});
	});
   });
});