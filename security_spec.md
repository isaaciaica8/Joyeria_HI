# Security Specification — Joyería HI Firestore Rules

## 1. Data Invariants
1. **Catálogo Público / Escritura Exclusiva Admin**: Cualquier visitante puede leer `products`, `banners` y `settings/storeInfo`, pero solo administradores autenticados y con correo verificado (`isAdmin()`) pueden crear, editar o eliminar productos, banners o configuraciones.
2. **Aislamiento Estricto de PII en `leads`**: Un visitante público únicamente puede crear un documento en `leads` con `status == 'nuevo'`, `createdAt == request.time`, `updatedAt == request.time` y campos validados. Ningún usuario no administrador puede leer (`get`, `list`), actualizar ni eliminar `leads`.
3. **Integridad Referencial de `productViews`**: Una consulta en `productViews` solo puede crearse si `productId` existe en `/products/{productId}` y `createdAt == request.time`.
4. **Inmutabilidad de `createdAt` y Prevención de Escalación**: `createdAt` es inmutable después de la creación, y ningún usuario no administrador puede escribir en `/admins/{userId}`.

## 2. "Dirty Dozen" Adversarial Test Payloads
1. **Shadow Field Injection on Lead**: `POST /leads` with extra `{ isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` check).
2. **Forged Lead Status**: `POST /leads` with `{ status: 'cerrado' }` by public visitor -> `PERMISSION_DENIED` (`status == 'nuevo'` enforced).
3. **PII Read Leak**: Non-admin user calls `get` or `list` on `/leads` -> `PERMISSION_DENIED`.
4. **Unverified Admin Email Spoof**: User with admin email but `email_verified == false` attempts write on `/products` -> `PERMISSION_DENIED`.
5. **ID Poisoning**: Creating `/products/` with a 500-char or invalid-char document ID -> `PERMISSION_DENIED` (`isValidId`).
6. **Negative Price Injection**: Admin or attacker attempts to create product with `price: -500` -> `PERMISSION_DENIED`.
7. **Discount Out-of-Range**: Product with `discountPercent: 150` -> `PERMISSION_DENIED`.
8. **Backdated Lead Timestamp**: Public `POST /leads` with forged `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
9. **Orphan ProductView**: `POST /productViews` with non-existent `productId` -> `PERMISSION_DENIED` (`exists()` check).
10. **Self-Assigned Admin**: Authenticated non-admin writes `/admins/{uid}` -> `PERMISSION_DENIED`.
11. **Mutated `createdAt` on Update**: Update changing `createdAt` -> `PERMISSION_DENIED`.
12. **Unbounded Images Array**: Product with `images` array > 10 items or non-string item -> `PERMISSION_DENIED`.
