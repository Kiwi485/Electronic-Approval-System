const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  where
} = require('firebase/firestore');

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');
const PROJECT_ID = 'electronic-approval-rules-test';

async function seedData(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'users', 'driver-1'), {
      role: 'driver',
      email: 'driver1@example.test',
      displayName: 'Driver One'
    });
    await setDoc(doc(adminDb, 'users', 'driver-2'), {
      role: 'driver',
      email: 'driver2@example.test',
      displayName: 'Driver Two'
    });
    await setDoc(doc(adminDb, 'users', 'manager-1'), {
      role: 'manager',
      email: 'manager1@example.test',
      displayName: 'Manager One'
    });

    await setDoc(doc(adminDb, 'deliveryNotes', 'note-driver-owned'), {
      customer: 'Alpha Co',
      createdBy: 'driver-1',
      createdByRole: 'driver',
      assignedTo: ['driver-1'],
      readableBy: ['driver-1'],
      signatureStatus: 'pending'
    });

    await setDoc(doc(adminDb, 'deliveryNotes', 'note-other-driver'), {
      customer: 'Beta Co',
      createdBy: 'driver-2',
      createdByRole: 'driver',
      assignedTo: ['driver-2'],
      readableBy: ['driver-2'],
      signatureStatus: 'pending'
    });

    await setDoc(doc(adminDb, 'deliveryNotes', 'note-manager'), {
      customer: 'Gamma Co',
      createdBy: 'manager-1',
      createdByRole: 'manager',
      assignedTo: ['driver-1', 'driver-2'],
      readableBy: ['manager-1', 'driver-1', 'driver-2'],
      signatureStatus: 'pending'
    });
  });
}

async function runTests() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8')
    }
  });

  try {
    await seedData(testEnv);

    const driver = testEnv.authenticatedContext('driver-1');
    const otherDriver = testEnv.authenticatedContext('driver-2');
    const manager = testEnv.authenticatedContext('manager-1');

    const driverDb = driver.firestore();
    const otherDriverDb = otherDriver.firestore();
    const managerDb = manager.firestore();

    // driver can read own note
    await assertSucceeds(getDoc(doc(driverDb, 'deliveryNotes', 'note-driver-owned')));

    // driver cannot read other driver's note
    await assertFails(getDoc(doc(driverDb, 'deliveryNotes', 'note-other-driver')));

    // driver cannot list every note (query should filter)
    await assertSucceeds(getDocs(query(collection(driverDb, 'deliveryNotes'), where('readableBy', 'array-contains', 'driver-1'))));
    await assertFails(getDocs(query(collection(driverDb, 'deliveryNotes'), where('signatureStatus', '==', 'pending'))));

    // driver can create note for self
    await assertSucceeds(addDoc(collection(driverDb, 'deliveryNotes'), {
      customer: 'Driver Self Job',
      createdBy: 'driver-1',
      createdByRole: 'driver',
      assignedTo: ['driver-1'],
      readableBy: ['driver-1'],
      signatureStatus: 'pending'
    }));

    // driver cannot create note on behalf of other uid
    await assertFails(addDoc(collection(driverDb, 'deliveryNotes'), {
      customer: 'Invalid Note',
      createdBy: 'driver-2',
      createdByRole: 'driver',
      assignedTo: ['driver-2'],
      readableBy: ['driver-2'],
      signatureStatus: 'pending'
    }));

    // driver can update signature fields without touching assignment
    await assertSucceeds(updateDoc(doc(driverDb, 'deliveryNotes', 'note-driver-owned'), {
      signatureStatus: 'completed'
    }));

    // driver cannot modify assignment arrays
    await assertFails(updateDoc(doc(driverDb, 'deliveryNotes', 'note-driver-owned'), {
      assignedTo: ['driver-1', 'driver-2']
    }));

    // manager can read all notes
    await assertSucceeds(getDoc(doc(managerDb, 'deliveryNotes', 'note-other-driver')));

    // manager can assign new drivers
    await assertSucceeds(updateDoc(doc(managerDb, 'deliveryNotes', 'note-manager'), {
      assignedTo: ['driver-1', 'driver-2'],
      readableBy: ['manager-1', 'driver-1', 'driver-2', 'driver-999']
    }));

    // driver can read own user doc but not others
    await assertSucceeds(getDoc(doc(driverDb, 'users', 'driver-1')));
    await assertFails(getDoc(doc(driverDb, 'users', 'driver-2')));

    // manager can read any user doc
    await assertSucceeds(getDoc(doc(managerDb, 'users', 'driver-2')));

    console.log('All Firestore rule tests completed');
  } finally {
    await testEnv.cleanup();
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Rules test failed:', err);
    process.exit(1);
  });
}
