import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDatabaseUrl} from '../backend/database-config.js';

test('database URI requires a host instead of silently falling back to localhost',()=>{
  for(const value of [undefined,'','postgres:///tsdb?sslmode=require','postgres:tsdb?sslmode=require','psql postgres://user:password@host:5432/tsdb','https://host/tsdb','postgres://host/']){
    assert.throws(()=>validateDatabaseUrl(value),/complete PostgreSQL connection URI/);
  }
});
test('valid PostgreSQL URIs are preserved, including encoded passwords and local databases',()=>{
  for(const value of ['postgresql://user:p%23ss%40word@db.example.com:25060/tsdb?sslmode=verify-full','postgres://localhost:5432/on_the_go']){
    assert.equal(validateDatabaseUrl(value),value);
  }
});
test('database validation errors never include credentials',()=>{
  const secret='private-password';
  try{validateDatabaseUrl(`postgres:user:${secret}`);assert.fail('expected invalid URI');}
  catch(error){assert(error instanceof Error);assert(!error.message.includes(secret));}
});
