import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, ShoppingCart, Download, Printer, ChevronRight, ChevronLeft, MapPin, CreditCard, FileText, Check } from 'lucide-react';
import SaudiRiyalSymbol from '../../components/storefront/SaudiRiyalSymbol';
import storeApi from '../../lib/storeApi';
import { optimizeImageUrl } from '../../lib/imageOptimizer';
import { useCart } from '../../store/storefrontCart';
import { useI18n } from '../../store/storefrontI18n';
import { firePixelEvent } from '../../components/storefront/StorefrontLayout';
import StorefrontSeo from '../../components/storefront/StorefrontSeo';
import StorefrontBreadcrumbs from '../../components/storefront/StorefrontBreadcrumbs';

const STEPS = [
  { key: 'shipping', icon: MapPin, label: 'shippingDetails' },
  { key: 'payment', icon: CreditCard, label: 'paymentMethod' },
  { key: 'review', icon: FileText, label: 'reviewOrder' },
];

export default function StorefrontCheckout() {
  const navigate = useNavigate();
  const { items, cartTotal, clearCart, cartId, setCartEmail, trackCart } = useCart();
  const { t, isRTL } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [step, setStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [shippingEstimate, setShippingEstimate] = useState(null);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [giftCardError, setGiftCardError] = useState('');
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', country: 'Saudi Arabia', notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    storeApi.get('/info').then((res) => setStoreInfo(res.data)).catch(() => {});
  }, []);

  const paymentMethods = storeInfo?.paymentMethods?.length ? storeInfo.paymentMethods : ['cod', 'moyasar'];
  const paymentLabel = (method) => {
    if (method === 'cod') return t('cashOnDelivery');
    if (method === 'tabby') return 'Tabby';
    if (method === 'tamara') return 'Tamara';
    if (method === 'moyasar' || method === 'tap' || method === 'paytabs' || method === 'stripe') return t('creditCard');
    return method;
  };

  useEffect(() => {
    if (paymentMethods.length && !paymentMethods.includes(paymentMethod)) {
      setPaymentMethod(paymentMethods[0]);
    }
  }, [storeInfo]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'email' && value) {
      setCartEmail(value);
      trackCart(value);
    }
  };

  // Inline validation on blur
  const validateField = (key) => {
    const val = (form[key] || '').trim();
    let err = '';
    if (key === 'name' && !val) err = t('nameRequired') || 'Name is required';
    if (key === 'phone' && !val) err = t('phoneRequired') || 'Phone is required';
    if (key === 'phone' && val && !/^[+]?[0-9\s-]{8,}$/.test(val)) err = t('phoneInvalid') || 'Invalid phone number';
    if (key === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) err = t('emailInvalid') || 'Invalid email';
    if (key === 'addressLine1' && !val) err = t('addressRequired') || 'Address is required';
    if (key === 'city' && !val) err = t('cityRequired') || 'City is required';
    setFieldErrors(prev => ({ ...prev, [key]: err }));
    return !err;
  };

  const clearFieldError = (key) => {
    if (fieldErrors[key]) setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Fire InitiateCheckout pixel event
  useEffect(() => {
    if (items.length > 0) {
      firePixelEvent('InitiateCheckout', {
        content_ids: items.map(i => i.productId),
        num_items: items.reduce((s, i) => s + i.quantity, 0),
        value: cartTotal,
        currency: 'SAR',
      });
    }
  }, []); // fire once on mount

  // Fetch shipping estimate
  useEffect(() => {
    if (items.length > 0) {
      storeApi.post('/shipping/estimate', { subtotal: cartTotal })
        .then(res => setShippingEstimate(res.data))
        .catch(() => setShippingEstimate(null));
    }
  }, [cartTotal, items.length]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await storeApi.post('/coupons/validate', { code: couponCode, subtotal: cartTotal });
      setAppliedCoupon(res.data);
    } catch (err) {
      setCouponError(err.response?.data?.error || t('invalidCoupon'));
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) return;
    setGiftCardLoading(true);
    setGiftCardError('');
    try {
      const res = await storeApi.post('/gift-card/check', { code: giftCardCode });
      setAppliedGiftCard(res.data);
    } catch (err) {
      setGiftCardError(err.response?.data?.error || t('invalidGiftCard'));
      setAppliedGiftCard(null);
    } finally {
      setGiftCardLoading(false);
    }
  };

  const discountAmount = appliedCoupon?.discountAmount || 0;
  const freeShipping = appliedCoupon?.freeShipping || shippingEstimate?.freeShipping || false;
  const shippingCost = freeShipping ? 0 : (shippingEstimate?.shippingCost || 0);
  const giftCardAmount = appliedGiftCard ? Math.min(appliedGiftCard.balance, Math.max(0, cartTotal - discountAmount + shippingCost)) : 0;
  const finalTotal = Math.max(0, cartTotal - discountAmount + shippingCost - giftCardAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { setError(t('namePhoneRequired')); return; }
    if (items.length === 0) { setError(t('cartIsEmpty')); return; }

    setLoading(true);
    setError('');
    try {
      const orderItems = items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      }));
      const res = await storeApi.post('/orders', { customer: form, items: orderItems, paymentMethod, giftCardCode: appliedGiftCard?.code });
      const { orderId, orderNumber } = res.data;

      // If online payment, initiate checkout
      if (paymentMethod !== 'cod') {
        const checkoutRes = await storeApi.post(`/checkout/${orderId}`, { provider: paymentMethod });
        if (checkoutRes.data.checkoutUrl) {
          window.location.href = checkoutRes.data.checkoutUrl;
          return;
        }
      }

      // Mark abandoned cart as recovered
      if (cartId) {
        try { await storeApi.post(`/abandoned-carts/recover/${cartId}`, { orderId }); } catch {}
      }
      clearCart();
      setSuccess({ orderNumber, orderId });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <StorefrontSeo title={`${t('orderNumber')} ${success.orderNumber} — ${t('orderConfirmed')}`} />
        <CheckCircle size={64} style={{ color: '#059669', margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{t('orderPlacedSuccess')}</h1>
        <p style={{ color: '#6b7280', marginBottom: '8px' }}>{t('orderNumber')}</p>
        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f46e5', marginBottom: '24px' }}>{success.orderNumber}</p>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '24px', textAlign: isRTL ? 'right' : 'left' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '12px' }}>{t('whatHappensNext')}</h3>
          <ul style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.8, paddingInlineStart: '20px', margin: 0 }}>
            <li>{t('receiveConfirmation')}</li>
            <li>{t('trackOrderPage')} <Link to="/store/track-order" style={{ color: '#4f46e5', fontWeight: 'bold' }}>{t('trackOrder')}</Link></li>
            <li>{t('useOrderNumber')} <strong>{success.orderNumber}</strong></li>
          </ul>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '12px 20px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', color: '#374151' }}>
            <Printer size={16} /> {t('printReceipt')}
          </button>
          <Link to="/store" style={{ display: 'inline-block', padding: '12px 28px', background: '#4f46e5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>{t('continueShopping')}</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
        <ShoppingCart size={64} style={{ color: '#d1d5db', margin: '0 auto 20px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.3px' }}>{t('yourCartIsEmpty')}</h1>
        <Link to="/store/products" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 700, fontSize: '15px' }}>{t('browseProducts')} →</Link>
      </div>
    );
  }

  const inputStyle = { width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' };
  const errorInputStyle = { ...inputStyle, borderColor: '#dc2626' };
  const errorLabelStyle = { fontSize: '12px', color: '#dc2626', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' };

  const validateShipping = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = t('nameRequired') || 'Name is required';
    if (!form.phone.trim()) errors.phone = t('phoneRequired') || 'Phone is required';
    else if (!/^[+]?[0-9\s-]{8,}$/.test(form.phone.trim())) errors.phone = t('phoneInvalid') || 'Invalid phone number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = t('emailInvalid') || 'Invalid email';
    if (!form.addressLine1.trim()) errors.addressLine1 = t('addressRequired') || 'Address is required';
    if (!form.city.trim()) errors.city = t('cityRequired') || 'City is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (step === 0 && !validateShipping()) return;
    setStep(prev => Math.min(prev + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>
      <StorefrontSeo title={t('checkout')} />
      <StorefrontBreadcrumbs items={[{ label: t('checkout') }]} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>{t('checkout')}</h1>
        <span style={{ fontSize: '13px', color: '#6b7280', background: '#f3f4f6', padding: '6px 14px', borderRadius: '999px', fontWeight: 700 }}>{t('guestCheckout')}</span>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', gap: '0' }}>
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const isComplete = i < step;
          const isActive = i === step;
          return (
            <React.Fragment key={s.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isComplete ? '#059669' : isActive ? '#4f46e5' : '#e5e7eb', color: isComplete || isActive ? '#fff' : '#9ca3af',
                  transition: 'all 0.3s', flexShrink: 0,
                }}>
                  {isComplete ? <Check size={18} /> : <StepIcon size={18} />}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: isActive ? '#4f46e5' : isComplete ? '#059669' : '#9ca3af', whiteSpace: 'nowrap' }}>
                  {t(s.label)}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '40px', height: '2px', background: i < step ? '#059669' : '#e5e7eb', margin: '0 12px', transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '14px', fontWeight: 600 }}><AlertCircle size={16} /> {error}</div>}

      <form id="checkout-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '32px' }} className="store-checkout-grid">
        {/* Left: Step content */}
        <div>
          {/* Step 0: Shipping */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('shippingDetails')}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>{t('fullName')}</label>
                  <input style={fieldErrors.name ? errorInputStyle : inputStyle} value={form.name} onChange={e => { update('name', e.target.value); clearFieldError('name'); }} onBlur={() => validateField('name')} required />
                  {fieldErrors.name && <p style={errorLabelStyle}><AlertCircle size={12} /> {fieldErrors.name}</p>}
                </div>
                <div>
                  <label style={labelStyle}>{t('phone')}</label>
                  <input style={fieldErrors.phone ? errorInputStyle : inputStyle} value={form.phone} onChange={e => { update('phone', e.target.value); clearFieldError('phone'); }} onBlur={() => validateField('phone')} required />
                  {fieldErrors.phone && <p style={errorLabelStyle}><AlertCircle size={12} /> {fieldErrors.phone}</p>}
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>{t('email')}</label>
                <input style={fieldErrors.email ? errorInputStyle : inputStyle} type="email" value={form.email} onChange={e => { update('email', e.target.value); clearFieldError('email'); }} onBlur={() => validateField('email')} />
                {fieldErrors.email && <p style={errorLabelStyle}><AlertCircle size={12} /> {fieldErrors.email}</p>}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>{t('addressLine1')}</label>
                <input style={fieldErrors.addressLine1 ? errorInputStyle : inputStyle} value={form.addressLine1} onChange={e => { update('addressLine1', e.target.value); clearFieldError('addressLine1'); }} onBlur={() => validateField('addressLine1')} placeholder={t('streetAddress')} />
                {fieldErrors.addressLine1 && <p style={errorLabelStyle}><AlertCircle size={12} /> {fieldErrors.addressLine1}</p>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>{t('city')}</label>
                  <input style={fieldErrors.city ? errorInputStyle : inputStyle} value={form.city} onChange={e => { update('city', e.target.value); clearFieldError('city'); }} onBlur={() => validateField('city')} />
                  {fieldErrors.city && <p style={errorLabelStyle}><AlertCircle size={12} /> {fieldErrors.city}</p>}
                </div>
                <div>
                  <label style={labelStyle}>{t('region')}</label>
                  <input style={inputStyle} value={form.region} onChange={e => update('region', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>{t('postalCode')}</label>
                  <input style={inputStyle} value={form.postalCode} onChange={e => update('postalCode', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('country')}</label>
                  <input style={inputStyle} value={form.country} onChange={e => update('country', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t('orderNotes')}</label>
                <textarea style={{ ...inputStyle, minHeight: '60px' }} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder={t('optionalNotes')} />
              </div>
              <button type="button" onClick={nextStep} style={{
                marginTop: '24px', padding: '14px 32px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', border: 'none', borderRadius: '14px',
                fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(79,70,229,0.25)',
              }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                {t('paymentMethod')} <ChevronRight size={18} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
              </button>
            </div>
          )}

          {/* Step 1: Payment */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('paymentMethod')}</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {paymentMethods.map((method) => (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', border: paymentMethod === method ? '2px solid #4f46e5' : '1px solid #e5e7eb', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s', background: paymentMethod === method ? '#eef2ff' : '#fff' }}>
                    <input type="radio" checked={paymentMethod === method} onChange={() => { setPaymentMethod(method); firePixelEvent('AddPaymentInfo', { value: finalTotal, currency: 'SAR', payment_method: method }); }} />
                    {(method === 'tabby' || method === 'tamara') ? (
                      <img src={method === 'tabby' ? '/tabby.png' : '/tamara.webp'} alt={method} style={{ height: method === 'tabby' ? 22 : 18, width: 'auto' }} />
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{paymentLabel(method)}</span>
                    )}
                  </label>
                ))}
              </div>

              {/* Shipping info summary */}
              <div style={{ marginTop: '24px', padding: '16px', background: '#f9fafb', borderRadius: '14px', border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{t('shippingDetails')}</h3>
                  <button type="button" onClick={() => setStep(0)} style={{ fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('edit')}</button>
                </div>
                <p style={{ fontSize: '13px', color: '#4b5563', margin: 0, lineHeight: 1.6 }}>
                  {form.name} • {form.phone}<br />
                  {form.addressLine1}{form.addressLine2 ? `, ${form.addressLine2}` : ''}<br />
                  {form.city}{form.region ? `, ${form.region}` : ''}{form.postalCode ? ` ${form.postalCode}` : ''}<br />
                  {form.country}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={prevStep} style={{
                  padding: '14px 24px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '14px',
                  fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
                }} onMouseEnter={e => e.currentTarget.style.borderColor = '#4f46e5'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                  <ChevronLeft size={18} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} /> {t('back')}
                </button>
                <button type="button" onClick={nextStep} style={{
                  padding: '14px 32px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', border: 'none', borderRadius: '14px',
                  fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(79,70,229,0.25)',
                }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  {t('reviewOrder')} <ChevronRight size={18} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('reviewOrder')}</h2>

              {/* Shipping review */}
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '14px', border: '1px solid #f3f4f6', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{t('shippingDetails')}</h3>
                  <button type="button" onClick={() => setStep(0)} style={{ fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('edit')}</button>
                </div>
                <p style={{ fontSize: '13px', color: '#4b5563', margin: 0, lineHeight: 1.6 }}>
                  {form.name} • {form.phone}<br />
                  {form.addressLine1}{form.addressLine2 ? `, ${form.addressLine2}` : ''}<br />
                  {form.city}{form.region ? `, ${form.region}` : ''}{form.postalCode ? ` ${form.postalCode}` : ''}<br />
                  {form.country}
                </p>
              </div>

              {/* Payment review */}
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '14px', border: '1px solid #f3f4f6', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{t('paymentMethod')}</h3>
                  <button type="button" onClick={() => setStep(1)} style={{ fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('edit')}</button>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111', margin: 0 }}>
                  {paymentLabel(paymentMethod)}
                </p>
              </div>

              {/* Items review */}
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '14px', border: '1px solid #f3f4f6' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>{t('orderItems')}</h3>
                {items.map(item => (
                  <div key={item.key} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    {item.image && <img src={optimizeImageUrl(item.image, { width: 100, quality: 80 })} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{t('qtyLabel')}: {item.quantity} × {item.price} <SaudiRiyalSymbol size={9} color="#6b7280" /></p>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>{item.price * item.quantity} <SaudiRiyalSymbol size={10} color="#111" /></span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={prevStep} style={{
                  padding: '14px 24px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '14px',
                  fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
                }} onMouseEnter={e => e.currentTarget.style.borderColor = '#4f46e5'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                  <ChevronLeft size={18} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} /> {t('back')}
                </button>
                <button type="submit" disabled={loading} style={{
                  padding: '14px 40px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: '14px',
                  fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(5,150,105,0.25)',
                }} onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : t('placeOrder')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Order summary (always visible) */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '24px', position: 'sticky', top: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('orderSummary')}</h2>
            <div style={{ marginBottom: '16px' }}>
              {items.map(item => (
                <div key={item.key} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  {item.image && <img src={optimizeImageUrl(item.image, { width: 100, quality: 80 })} alt="" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{t('qtyLabel')}: {item.quantity} × {item.price} <SaudiRiyalSymbol size={9} color="#6b7280" /></p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px', fontWeight: 500 }}>
              <span>{t('subtotal')}</span><span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>{cartTotal} <SaudiRiyalSymbol size={11} color="#111" /></span>
            </div>
            {/* Coupon input */}
            <div style={{ display: 'flex', gap: '6px', margin: '10px 0' }}>
              <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder={t('couponCode')} style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', outline: 'none' }} />
              <button type="button" onClick={handleApplyCoupon} disabled={couponLoading} style={{ padding: '10px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>{couponLoading ? '...' : t('apply')}</button>
            </div>
            {couponError && <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 8px' }}>{couponError}</p>}
            {appliedCoupon && <p style={{ fontSize: '12px', color: '#059669', margin: '0 0 8px', fontWeight: 'bold' }}>✓ {appliedCoupon.code} applied — {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% off` : appliedCoupon.type === 'fixed' ? `${appliedCoupon.value} SAR off` : 'Free shipping'}</p>}
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px', color: '#059669' }}>
                <span>{t('discount')}</span><span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>-{discountAmount} <SaudiRiyalSymbol size={10} color="#059669" /></span>
              </div>
            )}
            {/* Gift card input */}
            <div style={{ display: 'flex', gap: '6px', margin: '10px 0' }}>
              <input value={giftCardCode} onChange={e => setGiftCardCode(e.target.value)} placeholder={t('giftCardCode')} style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', outline: 'none' }} />
              <button type="button" onClick={handleApplyGiftCard} disabled={giftCardLoading} style={{ padding: '10px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>{giftCardLoading ? '...' : t('apply')}</button>
            </div>
            {giftCardError && <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 8px' }}>{giftCardError}</p>}
            {appliedGiftCard && <p style={{ fontSize: '12px', color: '#059669', margin: '0 0 8px', fontWeight: 'bold' }}>✓ {t('giftCardApplied')} — {giftCardAmount} <SaudiRiyalSymbol size={9} color="#059669" /> {t('giftCardDeducted')}</p>}
            {giftCardAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px', color: '#059669' }}>
                <span>{t('giftCard')}</span><span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>-{giftCardAmount} <SaudiRiyalSymbol size={10} color="#059669" /></span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px', color: '#6b7280' }}>
              <span>{t('shipping')}</span><span>{freeShipping ? t('free') : shippingEstimate ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>{shippingCost} <SaudiRiyalSymbol size={10} color="#6b7280" /></span> : t('calculatedAtCheckout')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 800, paddingTop: '14px', borderTop: '1px solid #e5e7eb', marginTop: '10px' }}>
              <span>{t('total')}</span><span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>{finalTotal} <SaudiRiyalSymbol size={15} color="#059669" /></span>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        @media(max-width:768px){.store-checkout-grid{grid-template-columns:1fr!important}}
        @media(max-width:768px){.store-mobile-sticky-bar{display:flex!important}}
      `}</style>

      {/* Mobile sticky checkout bar */}
      <div className="store-mobile-sticky-bar" style={{
        display: 'none', position: 'fixed', bottom: '56px', left: 0, right: 0, zIndex: 90,
        background: '#fff', borderTop: '1px solid #e5e7eb', padding: '12px 16px',
        alignItems: 'center', gap: '12px', boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, fontWeight: 500 }}>{t('total')}</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#059669', margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>{finalTotal} <SaudiRiyalSymbol size={15} color="#059669" /></p>
        </div>
        <button type="submit" form="checkout-form" disabled={loading} style={{
          padding: '14px 28px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', border: 'none', borderRadius: '14px',
          fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 4px 14px rgba(79,70,229,0.25)',
        }}>
          {loading ? '...' : t('placeOrder')}
        </button>
      </div>
    </div>
  );
}
