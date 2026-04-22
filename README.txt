TEE SHIRT - FIREBASE CHAT SYNC

Added:
- real Firebase Firestore message syncing
- real Firebase Storage image upload
- automatic low-resolution image compression before upload
- customer/admin chat threads
- typing indicators
- seen indicators
- inbox badge
- admin new-message beep

Important:
1. Upload all files to Netlify
2. Publish firestore.rules
3. Publish storage.rules.txt to Firebase Storage Rules
4. Firebase Storage must be enabled first

Image limits:
- max original file: 2MB
- max side: 1280px
- compressed JPEG target: around 280KB or lower
