import 'jest';

import * as functions from 'firebase-functions-test';
import * as admin from 'firebase-admin';

import { deleteUser } from '../src/deleteUserAll';

const testEnv = functions();

const wrapped = testEnv.wrap(deleteUser);

wrapped({ userID: "YHlJjBPCTtWtiBDBUvpbH7WRcxe2" })
  .then((result) => {
    console.log('Function result:', result);
  })
  .catch((error) => {
    console.error('Error calling function:', error);
  });

  