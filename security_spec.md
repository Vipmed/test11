# Security Specification - MedTest Pro

## Data Invariants
1. A user can only access their own settings and attempts.
2. Questions are read-only for regular users.
3. Admin roles can only be assigned by Superadmins.
4. Terminal state for payments (APPROVED/REJECTED) is immutable by the user.

## The Dirty Dozen Payloads (Targeting Firestore Rules)

1. **Identity Spoofing (User Profile)**: `setDoc('/users/target_uid', { role: 'SUPERADMIN', isApproved: true })` by a non-admin.
2. **Ghost Field (User Creation)**: `setDoc('/users/my_uid', { email: '...', role: 'USER', isApproved: false, extra: 'malicious' })` - should fail due to strict key check.
3. **Admin Escalation (Self)**: `updateDoc('/users/my_uid', { role: 'ADMIN' })` - should fail.
4. **Bypassing Approval**: `updateDoc('/users/my_uid', { isApproved: true })` - should fail.
5. **Question Poisoning**: `updateDoc('/questions/q1', { correctIdx: 5 })` by a USER.
6. **Orphaned Attempt**: `setDoc('/users/my_uid/attempts/a1', { questionId: 'non_existent_id', ... })` - should fail via `exists()` check.
7. **Cross-User Data Leak**: `getDoc('/users/other_uid/settings/current')`.
8. **Payment Tampering**: `updateDoc('/payments/p1', { status: 'APPROVED' })` by the user who created it.
9. **Log Erasure**: `deleteDoc('/logs/l1')` - should be denied for everyone except perhaps Superadmin.
10. **Resource Exhaustion (Junk ID)**: `setDoc('/questions/very-long-id-over-128-chars...', { ... })`.
11. **Shadow Update (Settings)**: `updateDoc('/users/my_uid/settings/current', { theme: 'dark', maliciousKey: true })`.
12. **Status Shortcutting**: Attempting to move a payment from `PENDING` directly to `APPROVED` without proper admin auth.

## Test Runner Logic
The `firestore.rules.test.ts` will verify these payloads return `PERMISSION_DENIED`.
