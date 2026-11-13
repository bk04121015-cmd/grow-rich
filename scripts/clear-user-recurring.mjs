import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

console.log('Firebase config projectId:', config.projectId)
if (!config.apiKey || !config.projectId) {
  console.error('Missing Firebase configuration from environment variables!')
  process.exit(1)
}

const app = initializeApp(config)
const db = getFirestore(app)
const PHONE = process.env.TARGET_PHONE || ''

async function run() {
  console.log(`\n=== 1. Reading current userData doc for ${PHONE} ===`)
  const userDocRef = doc(db, 'userData', PHONE)
  const userDocSnap = await getDoc(userDocRef)
  
  if (!userDocSnap.exists()) {
    console.error(`userData doc for ${PHONE} does not exist!`)
  } else {
    const userData = userDocSnap.data()
    console.log('Current userData keys:', Object.keys(userData))
    console.log(`Current transactions count: ${userData.transactions?.length ?? 0}`)
    if (userData.transactions?.length > 0) {
      console.log('First transaction sample:', JSON.stringify(userData.transactions[0], null, 2))
      console.log('Last transaction sample:', JSON.stringify(userData.transactions[userData.transactions.length - 1], null, 2))
    }
  }

  console.log(`\n=== 2. Setting transactions to [] in userData for ${PHONE} ===`)
  await setDoc(userDocRef, { transactions: [] }, { merge: true })
  console.log('Successfully updated userData transactions to []')

  console.log(`\n=== 3. Reading current userSettings doc for ${PHONE} ===`)
  const settingsDocRef = doc(db, 'userSettings', PHONE)
  const settingsDocSnap = await getDoc(settingsDocRef)

  if (!settingsDocSnap.exists()) {
    console.error(`userSettings doc for ${PHONE} does not exist!`)
  } else {
    const settingsData = settingsDocSnap.data()
    console.log('Current userSettings keys:', Object.keys(settingsData))
    console.log(`Current recurringFixed count: ${settingsData.recurringFixed?.length ?? 0}`)
    if (settingsData.recurringFixed?.length > 0) {
      console.log('recurringFixed sample:', JSON.stringify(settingsData.recurringFixed, null, 2))
    }
  }

  console.log(`\n=== 4. Setting recurringFixed to [] in userSettings for ${PHONE} ===`)
  await setDoc(settingsDocRef, { recurringFixed: [] }, { merge: true })
  console.log('Successfully updated userSettings recurringFixed to []')

  console.log(`\n=== 5. Verifying both documents ===`)
  const verifiedUserSnap = await getDoc(userDocRef)
  const verifiedUserData = verifiedUserSnap.data()
  console.log('Verified userData transactions count:', verifiedUserData.transactions?.length)
  console.log('Verified userData preserved fields:', {
    expectedIncome: verifiedUserData.expectedIncome,
    budgetsCount: verifiedUserData.budgets?.length,
    savingGoal: verifiedUserData.savingGoal,
    reflectionPoints: verifiedUserData.reflectionPoints,
    praisePoints: verifiedUserData.praisePoints,
    consumptionGoal: verifiedUserData.consumptionGoal,
    wishList: verifiedUserData.wishList,
  })

  const verifiedSettingsSnap = await getDoc(settingsDocRef)
  const verifiedSettingsData = verifiedSettingsSnap.data()
  console.log('Verified userSettings recurringFixed count:', verifiedSettingsData.recurringFixed?.length)
  console.log('Verified userSettings preserved catGroups:', verifiedSettingsData.catGroups ? Object.keys(verifiedSettingsData.catGroups) : null)
  if (verifiedSettingsData.notionConfig) {
    console.log('Verified userSettings notionConfig preserved:', true)
  }

  console.log('\n=== Operation Complete Successfully ===')
  process.exit(0)
}

run().catch((err) => {
  console.error('Error during execution:', err)
  process.exit(1)
})
