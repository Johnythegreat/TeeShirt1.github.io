TEE SHIRT - MESSAGES SYSTEM + IMAGE SENDING

Base:
- tee-shirt-messages-system.zip behavior retained
- Start Custom Design opens the message form

Added:
- customer can send one image with the message
- admin can send one image when replying
- automatic low-resolution compression before upload

Important:
1. Enable Firebase Storage
2. Publish firestore.rules
3. Open storage.rules.txt and publish that in Firebase Storage Rules

Image limits:
- original file max: 2MB
- compressed JPEG target: around 280KB
- max side: 1280px
