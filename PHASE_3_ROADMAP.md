# Phase 3: Frontend Modernization - Roadmap

## 🎯 Hedef

Gerçek restoran kullanımı için Customer Menu, Waiter, Admin ve Super Admin panellerinin UI/UX'ini modernize etmek.

## 📋 Kapsam

### 1. Customer Menu Panel (Mobil-First)

**Öncelik: Yüksek** - Müşteri deneyimi kritik

- [ ] Mobile-first responsive layout
- [ ] Sticky category navigation
- [ ] Product cards (image, name, description, price, stock status)
- [ ] Out-of-stock items disabled
- [ ] Cart drawer (mobile-optimized)
- [ ] Quantity stepper (large touch targets)
- [ ] Customer note per item
- [ ] Order confirmation & status feedback
- [ ] Lazy loading images
- [ ] Skeleton loading states
- [ ] Accessibility (ARIA, focus states, labels)

**Dosyalar:**
- `src/app/menu/[businessId]/[tableNumber]/page.tsx`
- `src/components/customer/ProductCard.tsx` (yeni)
- `src/components/customer/CartDrawer.tsx` (yeni)
- `src/components/customer/CategoryNav.tsx` (yeni)
- `src/components/customer/QuantityStepper.tsx` (yeni)

### 2. Waiter Panel (Phone/Tablet Optimized)

**Öncelik: Yüksek** - Operasyonel verimlilik

- [ ] Dashboard optimized for phone/tablet
- [ ] Tab navigation (Orders, Service Requests, Tables, Payments)
- [ ] Urgent items first (payment requests, waiter calls, new orders)
- [ ] Large action buttons
- [ ] Prevent duplicate clicks
- [ ] Real-time visual alerts
- [ ] Sound mute toggle
- [ ] Offline/reconnecting state

**Dosyalar:**
- `src/app/waiter/page.tsx`
- `src/components/waiter/OrderCard.tsx` (yeni)
- `src/components/waiter/ServiceRequestCard.tsx` (yeni)
- `src/components/waiter/TableCard.tsx` (yeni)
- `src/components/waiter/TabNavigation.tsx` (yeni)
- `src/components/waiter/SoundToggle.tsx` (yeni)
- `src/components/waiter/OfflineIndicator.tsx` (yeni)

### 3. Admin Panel (Desktop/Tablet)

**Öncelik: Orta** - Yönetim kolaylığı

- [ ] Clean dashboard (today's orders, active tables, pending requests, out-of-stock, revenue)
- [ ] Product management (stock toggle, availability toggle, image preview, category filter)
- [ ] Table management (QR regenerate, print QR, active session indicator)
- [ ] Staff management (add/deactivate, reset password placeholder, role visibility)

**Dosyalar:**
- `src/app/admin/page.tsx`
- `src/app/admin/products/page.tsx`
- `src/app/admin/tables/page.tsx`
- `src/app/admin/staff/page.tsx`
- `src/components/admin/DashboardCard.tsx` (yeni)
- `src/components/admin/ProductTable.tsx` (yeni)
- `src/components/admin/TableQRCode.tsx` (yeni)

### 4. Super Admin Panel

**Öncelik: Düşük** - Az kullanılır

- [ ] Tenant list
- [ ] Subscription status
- [ ] Tenant health
- [ ] Support access flow with audit reason

**Dosyalar:**
- `src/app/super-admin/page.tsx`
- `src/components/super-admin/TenantCard.tsx` (yeni)

## 🎨 Design System

### Color Palette

```typescript
// Tailwind config extension
colors: {
  primary: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
}
```

### Typography

- Headings: `font-bold`
- Body: `font-normal`
- Small: `text-sm`
- Large buttons: `text-lg`

### Spacing

- Mobile padding: `p-4`
- Desktop padding: `p-6`
- Card spacing: `space-y-4`
- Button spacing: `px-6 py-3`

### Components

**Buttons:**
- Primary: `bg-primary-600 hover:bg-primary-700 text-white`
- Secondary: `bg-gray-200 hover:bg-gray-300 text-gray-900`
- Danger: `bg-red-600 hover:bg-red-700 text-white`
- Large: `px-6 py-4 text-lg` (mobile touch targets)

**Cards:**
- Shadow: `shadow-md hover:shadow-lg`
- Border: `border border-gray-200`
- Rounded: `rounded-lg`

**Inputs:**
- Base: `border border-gray-300 rounded-lg px-4 py-2`
- Focus: `focus:ring-2 focus:ring-primary-500 focus:border-primary-500`
- Error: `border-red-500 focus:ring-red-500`

## 📱 Responsive Breakpoints

```typescript
// Tailwind default breakpoints
sm: '640px',   // Mobile landscape
md: '768px',   // Tablet
lg: '1024px',  // Desktop
xl: '1280px',  // Large desktop
```

**Strategy:**
- Customer Menu: Mobile-first (sm → md)
- Waiter Panel: Tablet-first (md → lg)
- Admin Panel: Desktop-first (lg → xl)
- Super Admin: Desktop-only (lg+)

## ♿ Accessibility Requirements

### WCAG 2.1 Level AA

1. **Keyboard Navigation**
   - All interactive elements focusable
   - Visible focus indicators
   - Logical tab order

2. **Screen Reader Support**
   - Semantic HTML
   - ARIA labels where needed
   - ARIA live regions for dynamic content

3. **Color Contrast**
   - Text: 4.5:1 minimum
   - Large text: 3:1 minimum
   - No color-only indicators

4. **Touch Targets**
   - Minimum 44x44px
   - Adequate spacing between targets

5. **Form Labels**
   - All inputs have labels
   - Error messages associated with inputs

## 🚀 Performance Targets

### Customer Menu
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Largest Contentful Paint: < 2.5s

### Waiter Panel
- Initial Load: < 2s
- Real-time Update Latency: < 500ms
- Action Response: < 200ms

### Admin Panel
- Dashboard Load: < 2s
- Table Render: < 1s (100 items)

## 🛠️ Implementation Strategy

### Phase 3.1: Customer Menu (1-2 hafta)

**Week 1:**
- [ ] Mobile-first layout
- [ ] Product cards
- [ ] Category navigation
- [ ] Cart drawer

**Week 2:**
- [ ] Quantity stepper
- [ ] Customer notes
- [ ] Order confirmation
- [ ] Loading states
- [ ] Accessibility

### Phase 3.2: Waiter Panel (1-2 hafta)

**Week 1:**
- [ ] Tab navigation
- [ ] Order cards
- [ ] Service request cards
- [ ] Large action buttons

**Week 2:**
- [ ] Real-time alerts
- [ ] Sound toggle
- [ ] Offline state
- [ ] Duplicate click prevention

### Phase 3.3: Admin Panel (1-2 hafta)

**Week 1:**
- [ ] Dashboard
- [ ] Product management
- [ ] Stock toggles

**Week 2:**
- [ ] Table management
- [ ] QR code features
- [ ] Staff management

### Phase 3.4: Super Admin Panel (3-5 gün)

- [ ] Tenant list
- [ ] Subscription status
- [ ] Health indicators
- [ ] Support access

## 📦 New Dependencies (Minimal)

### Recommended

```json
{
  "react-hot-toast": "^2.4.1",        // Toast notifications
  "react-loading-skeleton": "^3.3.1", // Skeleton loading
  "qrcode.react": "^3.1.0",           // QR code generation
  "date-fns": "^2.30.0"               // Date formatting
}
```

### Optional

```json
{
  "framer-motion": "^10.16.4",        // Animations (if needed)
  "react-intersection-observer": "^9.5.3" // Lazy loading
}
```

## 🧪 Testing Strategy

### Unit Tests
- Component rendering
- User interactions
- Accessibility

### Integration Tests
- User flows
- API integration
- Real-time updates

### E2E Tests
- Customer order flow
- Waiter order management
- Admin CRUD operations

## 📊 Success Metrics

### Customer Menu
- Order completion rate > 90%
- Average order time < 3 minutes
- Cart abandonment rate < 20%

### Waiter Panel
- Order processing time < 30 seconds
- Service request response time < 2 minutes
- User satisfaction > 4/5

### Admin Panel
- Task completion time -30%
- Error rate < 5%
- User satisfaction > 4/5

## 🔄 Migration Notes

### Breaking Changes
- Component structure değişecek
- CSS class'ları güncellenecek
- Bazı prop interface'leri değişecek

### Backward Compatibility
- Mevcut API'ler değişmeyecek
- Database schema değişmeyecek
- Authentication flow değişmeyecek

## 📝 Documentation

### Component Documentation
- Storybook (opsiyonel)
- README per component
- Usage examples

### User Documentation
- Customer guide
- Waiter guide
- Admin guide

## 🚀 Deployment Strategy

### Staging
1. Deploy to staging
2. Internal testing
3. User acceptance testing

### Production
1. Feature flags
2. Gradual rollout
3. Monitor metrics
4. Rollback plan

## 📞 Support

### Development
- Frontend lead: [Name]
- Backend lead: [Name]
- Design lead: [Name]

### Issues
- Bug reports: GitHub Issues
- Feature requests: GitHub Discussions
- Security: security@example.com

---

**Status:** 📋 Planning  
**Start Date:** TBD  
**Estimated Duration:** 4-6 hafta  
**Priority:** High (Customer Menu), Medium (Waiter/Admin)
