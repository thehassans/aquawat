import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Eye, Heart, ShoppingCart, Star, Check, Sparkles, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import SaudiRiyalSymbol from '../../components/storefront/SaudiRiyalSymbol';
import storeApi from '../../lib/storeApi';
import { optimizeImageUrl } from '../../lib/imageOptimizer';
import StorefrontSeo from '../../components/storefront/StorefrontSeo';
import QuickViewModal from '../../components/storefront/QuickViewModal';
import { useRecentlyViewed } from '../../store/recentlyViewed';
import { useCart } from '../../store/storefrontCart';
import { useWishlist } from '../../store/storefrontWishlist';
import { useI18n } from '../../store/storefrontI18n';
import { useToast, Skeleton, SkeletonGrid } from '../../components/storefront/StorefrontUi';
import { sanitizeHtml } from '../../lib/sanitizeHtml';

export default function StorefrontHome() {
  const [storeInfo, setStoreInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState('');
  const { items: recentItems } = useRecentlyViewed();
  const { t, isRTL } = useI18n();

  useEffect(() => {
    Promise.all([
      storeApi.get('/info'),
      storeApi.get('/products?limit=12&sort=popular'),
    ]).then(([infoRes, prodRes]) => {
      setStoreInfo(infoRes.data);
      setProducts(prodRes.data.products);
      const cats = [...new Set(prodRes.data.products.map(p => p.category).filter(Boolean))];
      setCategories(cats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      <Skeleton w="60%" h="36px" r="8px" mb="12px" />
      <Skeleton w="40%" h="18px" r="8px" mb="40px" />
      <SkeletonGrid count={8} />
    </div>
  );

  const storeName = storeInfo?.storeName || 'Store';
  const seoTitle = storeInfo?.seo?.metaTitle || `${storeName} — Online Store`;
  const seoDesc = storeInfo?.seo?.metaDescription || `Shop at ${storeName}`;
  const seoImage = storeInfo?.seo?.ogImage || '';

  const theme = storeInfo?.theme || {};
  const colors = theme.colors || {};
  const c = (key, fallback) => colors[key] || fallback;
  const sections = theme.homepage?.sections || [];
  const currency = storeInfo?.currency || 'SAR';

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus('loading');
    try {
      await storeApi.post('/newsletter/subscribe', { email: newsletterEmail });
      setNewsletterStatus('success');
      setNewsletterEmail('');
    } catch {
      setNewsletterStatus('error');
    }
  };

  const renderSection = (section) => {
    if (!section.enabled) return null;
    const s = section.settings || {};
    switch (section.type) {
      case 'hero':
        return <HeroCarousel key={section.id} settings={s} c={c} t={t} isRTL={isRTL} />;
      case 'product-carousel':
        return (
          <div key={section.id} style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: c('text', '#111'), letterSpacing: '-0.3px' }}>{s.title || 'Products'}</h3>
              <Link to="/store/products" style={{ color: c('primary', '#4f46e5'), textDecoration: 'none', fontSize: '14px', fontWeight: 700, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>{t('viewAll')} →</Link>
            </div>
            <div className="sf-grid">
              {products.slice(0, s.limit || 8).map(p => (
                <ProductCard key={p._id} product={p} currency={currency} colors={colors} onQuickView={() => setQuickViewProduct(p)} />
              ))}
            </div>
          </div>
        );
      case 'flash-sale':
        return <FlashSaleSection key={section.id} settings={s} products={products} currency={currency} colors={colors} onQuickView={setQuickViewProduct} />;
      case 'category-grid':
        return (
          <div key={section.id} style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', color: c('text', '#111'), letterSpacing: '-0.3px' }}>{s.title || t('categories')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${s.columns || 4}, 1fr)`, gap: '16px' }}>
              {(categories.length > 0 ? categories.slice(0, s.columns || 4) : ['Category 1', 'Category 2', 'Category 3', 'Category 4']).map((cat, i) => (
                <Link key={i} to={`/store/products?category=${encodeURIComponent(cat)}`} style={{
                  background: `linear-gradient(135deg, ${c('surface', '#f9fafb')}, #fff)`, border: `1px solid ${c('borderColor', '#e5e7eb')}`,
                  borderRadius: '16px', padding: '32px 24px', textAlign: 'center', textDecoration: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = c('primary', '#4f46e5') + '40'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = c('borderColor', '#e5e7eb'); }}
                >
                  <p style={{ fontWeight: 700, color: c('text', '#111'), margin: 0, fontSize: '15px' }}>{cat}</p>
                </Link>
              ))}
            </div>
          </div>
        );
      case 'newsletter':
        return (
          <form key={section.id} onSubmit={handleNewsletterSubmit} style={{
            background: `linear-gradient(135deg, ${c('primary', '#4f46e5')}, ${c('accent', '#7c3aed')})`, padding: '48px 24px', textAlign: 'center',
            borderRadius: '24px', marginBottom: '40px', position: 'relative', overflow: 'hidden',
            boxShadow: '0 20px 60px -15px rgba(79,70,229,0.3)',
          }}>
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ color: '#fff', fontSize: '26px', margin: '0 0 8px', fontWeight: 800 }}>{s.title || t('subscribe')}</h3>
              <p style={{ color: '#fff', opacity: 0.9, margin: '0 0 24px', fontSize: '15px' }}>{s.subtitle || t('emailPlaceholder')}</p>
              <div style={{ display: 'flex', gap: '8px', maxWidth: '420px', margin: '0 auto' }}>
                <input placeholder={t('emailPlaceholder')} value={newsletterEmail} onChange={e => setNewsletterEmail(e.target.value)} type="email" required style={{ flex: 1, padding: '14px 18px', border: 'none', borderRadius: '12px', fontSize: '15px', outline: 'none' }} />
                <button type="submit" disabled={newsletterStatus === 'loading'} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '15px', backdropFilter: 'blur(10px)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>{newsletterStatus === 'loading' ? '...' : t('subscribe')}</button>
              </div>
              {newsletterStatus === 'success' && <p style={{ color: '#fff', marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>✓ {t('thanksSubscribing')}</p>}
              {newsletterStatus === 'error' && <p style={{ color: '#fecaca', marginTop: '12px', fontSize: '14px' }}>Failed to subscribe. Please try again.</p>}
            </div>
          </form>
        );
      case 'rich-text':
        return (
          <div key={section.id} style={{ maxWidth: '800px', margin: '0 auto 32px', padding: '16px' }}>
            {s.title && <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: c('text', '#111') }}>{s.title}</h3>}
            <div style={{ color: c('textMuted', '#6b7280'), fontSize: '15px', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.content || '') }} />
          </div>
        );
      case 'image-banner':
        return <ImageBanner key={section.id} settings={s} c={c} t={t} isRTL={isRTL} />;
      case 'testimonial':
        return (
          <div key={section.id} style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', color: c('text', '#111'), letterSpacing: '-0.3px' }}>{s.title || 'Testimonials'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {(s.items || []).map((item, i) => (
                <div key={i} style={{ background: '#fff', border: `1px solid ${c('borderColor', '#e5e7eb')}`, borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.3s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
                >
                  <div style={{ fontSize: '28px', color: c('primary', '#4f46e5'), lineHeight: 1, marginBottom: '8px' }}>“</div>
                  <p style={{ color: c('text', '#111'), fontSize: '15px', fontStyle: 'italic', margin: '0 0 16px', lineHeight: 1.6 }}>{item.text || ''}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, ${c('primary', '#4f46e5')}, ${c('accent', '#7c3aed')})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px' }}>{(item.author || 'C')[0]}</div>
                    <p style={{ color: c('textMuted', '#6b7280'), fontSize: '14px', fontWeight: 600, margin: 0 }}>— {item.author || 'Customer'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'faq':
        return (
          <div key={section.id} style={{ maxWidth: '800px', margin: '0 auto 32px', padding: '16px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '16px', color: c('text', '#111') }}>{s.title || 'FAQ'}</h3>
            {(s.items || []).map((item, i) => (
              <details key={i} style={{ borderBottom: `1px solid ${c('borderColor', '#e5e7eb')}`, padding: '12px 0' }}>
                <summary style={{ fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', color: c('text', '#111') }}>{item.question || ''}</summary>
                <p style={{ color: c('textMuted', '#6b7280'), fontSize: '14px', margin: '8px 0 0', lineHeight: 1.6 }}>{item.answer || ''}</p>
              </details>
            ))}
          </div>
        );
      case 'spacer':
        return <div key={section.id} style={{ height: `${s.height || 40}px` }} />;
      case 'custom-html':
        return <div key={section.id} style={{ marginBottom: '32px' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html || '') }} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      <StorefrontSeo title={seoTitle} description={seoDesc} image={seoImage} url={window.location.href} siteName={storeName} />
      <style>{`
        .sf-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 640px) { .sf-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; } }
        @media (min-width: 1024px) { .sf-grid { grid-template-columns: repeat(4, 1fr); gap: 24px; } }
        .sf-product-card:hover { transform: translateY(-8px); box-shadow: 0 18px 40px rgba(0,0,0,0.12); border-color: var(--sf-primary, #4f46e5) !important; }
        .sf-product-card:hover .sf-card-img { transform: scale(1.08); }
        .sf-card-actions { opacity: 0; transform: translateX(8px); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; }
        .sf-product-card:hover .sf-card-actions { opacity: 1; transform: translateX(0); pointer-events: auto; }
        .sf-card-cart { max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease, padding 0.35s ease; padding-top: 0 !important; padding-bottom: 0 !important; }
        .sf-product-card:hover .sf-card-cart { max-height: 80px; opacity: 1; padding-bottom: 16px !important; }
        @media (hover: none) { .sf-card-actions { opacity: 1; transform: none; pointer-events: auto; } .sf-card-cart { max-height: 80px; opacity: 1; padding-bottom: 16px !important; } }
        @media (max-width: 768px) { .sf-hero-grid { flex-direction: column !important; padding: 32px 20px !important; gap: 24px !important; } .sf-hero-products { display: none !important; } }
      `}</style>
      {sections.length > 0 ? sections.map(renderSection) : (
        // Fallback if no theme configured
        <>
          {/* Hero — ultra premium minimalistic */}
          <div style={{
            position: 'relative', marginBottom: '48px', borderRadius: '20px', overflow: 'hidden',
            background: `linear-gradient(135deg, ${c('surface', '#f9fafb')} 0%, #fff 100%)`,
            minHeight: '380px', display: 'flex', alignItems: 'center',
            border: `1px solid ${c('borderColor', '#e5e7eb')}`,
          }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '48px', padding: '48px 40px', width: '100%' }} className="sf-hero-grid">
              {/* Left: Logo + text */}
              <div style={{ flex: '1 1 320px' }}>
                {/* Maqder logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: `linear-gradient(135deg, ${c('primary', '#059669')}, ${c('primary', '#059669')}dd)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7h18M3 12h18M3 17h12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: 800, color: c('text', '#111'), letterSpacing: '-0.5px' }}>
                    {storeInfo?.storeName || 'Maqder'}
                  </span>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `${c('primary', '#059669')}0d`, color: c('primary', '#059669'), padding: '6px 14px', borderRadius: '999px', marginBottom: '20px' }}>
                  <Sparkles size={13} />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('newArrivals')}</span>
                </div>

                <h1 style={{ fontSize: '40px', margin: '0 0 12px', fontWeight: 900, letterSpacing: '-1.2px', lineHeight: 1.1, color: c('text', '#111') }}>
                  {t('welcomeStore')}
                </h1>
                <p style={{ color: c('textMuted', '#6b7280'), margin: '0 0 32px', fontSize: '16px', lineHeight: 1.6, maxWidth: '360px' }}>
                  {t('subscribeForOffers')}
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link to="/store/products" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: c('primary', '#059669'), color: '#fff',
                    padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '15px',
                    transition: 'all 0.25s', boxShadow: '0 4px 14px rgba(5,150,105,0.2)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(5,150,105,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(5,150,105,0.2)'; }}
                  >
                    {t('shopNow')} <ArrowRight size={18} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
                  </Link>
                  <Link to="/store/products?sort=popular" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'transparent', color: c('text', '#111'), border: `1px solid ${c('borderColor', '#e5e7eb')}`,
                    padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '15px',
                    transition: 'all 0.25s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c('text', '#111'); }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c('borderColor', '#e5e7eb'); }}
                  >
                    <TrendingUp size={18} /> {t('bestSellers')}
                  </Link>
                </div>
              </div>

              {/* Right: Product showcase — minimal */}
              {products.length > 0 && (
                <div style={{ flex: '0 0 auto', display: 'flex', gap: '12px', alignItems: 'center' }} className="sf-hero-products">
                  {products.slice(0, 3).map((p, i) => {
                    const slug = p.seo?.slug || p._id;
                    return (
                      <Link key={p._id} to={`/store/products/${slug}`} style={{
                        textDecoration: 'none', display: 'block', position: 'relative',
                        transform: i === 1 ? 'translateY(-12px)' : 'translateY(0)',
                        transition: 'transform 0.3s ease',
                      }}
                        onMouseEnter={e => e.currentTarget.style.transform = i === 1 ? 'translateY(-18px)' : 'translateY(-6px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = i === 1 ? 'translateY(-12px)' : 'translateY(0)'}
                      >
                        <div style={{
                          width: '130px', height: '170px', borderRadius: '16px', overflow: 'hidden',
                          background: c('surface', '#f9fafb'), border: `1px solid ${c('borderColor', '#e5e7eb')}`,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.06)', position: 'relative',
                        }}>
                          {p.images?.[0]?.url ? (
                            <img src={optimizeImageUrl(p.images[0].url, { width: 400, quality: 80 })} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '11px', color: c('textMuted', '#9ca3af') }}>No image</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px', background: 'linear-gradient(transparent, rgba(255,255,255,0.95))' }}>
                            <p style={{ color: c('text', '#111'), fontSize: '11px', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <span style={{ color: c('primary', '#059669'), fontSize: '13px', fontWeight: 800 }}>{p.basePrice}</span>
                              <SaudiRiyalSymbol size={10} color={c('primary', '#059669')} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Featured Products */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-0.5px', margin: 0 }}>{t('featuredProducts')}</h3>
                <p style={{ color: c('textMuted', '#6b7280'), fontSize: '14px', margin: 0 }}>{t('subscribeForOffers')}</p>
              </div>
              <Link to="/store/products" style={{ color: c('primary', '#4f46e5'), textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>{t('viewAll')} →</Link>
            </div>
            <div className="sf-grid">
              {products.map(p => <ProductCard key={p._id} product={p} currency={currency} colors={colors} onQuickView={() => setQuickViewProduct(p)} />)}
            </div>
          </div>
        </>
      )}

      {/* Recently viewed products */}
      {recentItems.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.3px' }}>{t('recentlyViewed')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }}>
            {recentItems.slice(0, 6).map(item => (
              <Link key={item.productId} to={`/store/products/${item.slug}`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', textDecoration: 'none', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ aspectRatio: '1', background: '#e5e7eb', overflow: 'hidden' }}>
                  {item.image ? <img src={optimizeImageUrl(item.image, { width: 200, quality: 80 })} alt={item.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} /> : null}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111' }}>{item.title}</p>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#059669', margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>{item.price} <SaudiRiyalSymbol size={12} color="#059669" /></p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* You may also like — ultra premium */}
      {products.length > 4 && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '26px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px', color: c('text', '#111') }}>{t('youMayAlsoLike')}</h3>
            <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${c('borderColor', '#e5e7eb')} 0%, transparent 100%)` }} />
          </div>
          <div className="sf-grid">
            {products.slice(-4).reverse().map(p => (
              <ProductCard key={p._id + '-rec'} product={p} currency={currency} colors={colors} onQuickView={() => setQuickViewProduct(p)} />
            ))}
          </div>
        </div>
      )}

      {/* Quick view modal */}
      {quickViewProduct && (
        <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} currency={currency} />
      )}
    </div>
  );
}

// ==================== Hero Carousel Component ====================
function HeroCarousel({ settings, c, t, isRTL }) {
  const slides = settings.slides || [];
  const autoPlay = settings.autoPlay !== false;
  const interval = settings.interval || 5000;
  const [current, setCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragDelta = useRef(0);
  const containerRef = useRef(null);
  const autoPlayRef = useRef(null);

  // Build slides array: use multi-slide config if available, otherwise fall back to single slide
  const allSlides = slides.length > 0 ? slides : [{
    imageUrl: settings.imageUrl || '',
    title: settings.title || t('welcomeStore'),
    subtitle: settings.subtitle || '',
    buttonText: settings.buttonText || t('shopNow'),
    buttonLink: settings.buttonLink || '/store/products',
    textPosition: settings.textPosition || 'left',
  }].filter(s => s.imageUrl || s.title);

  const slideCount = allSlides.length;
  const isSingle = slideCount <= 1;

  const goTo = useCallback((idx) => {
    setCurrent(((idx % slideCount) + slideCount) % slideCount);
  }, [slideCount]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay || isSingle) return;
    autoPlayRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % slideCount);
    }, interval);
    return () => clearInterval(autoPlayRef.current);
  }, [autoPlay, isSingle, slideCount, interval]);

  // Pause on hover
  const pauseAuto = () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  const resumeAuto = () => {
    if (!autoPlay || isSingle) return;
    autoPlayRef.current = setInterval(() => setCurrent(prev => (prev + 1) % slideCount), interval);
  };

  // Touch/swipe handlers
  const handleTouchStart = (e) => {
    dragStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
    pauseAuto();
  };
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragDelta.current = x - dragStartX.current;
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragDelta.current) > 50) {
      dragDelta.current > 0 ? prev() : next();
    }
    dragDelta.current = 0;
    resumeAuto();
  };

  if (allSlides.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="sf-hero-carousel"
      style={{
        position: 'relative', marginBottom: '40px', borderRadius: '20px', overflow: 'hidden',
        minHeight: isSingle ? '320px' : '400px', background: '#f3f4f6',
        touchAction: 'pan-y',
      }}
      onMouseEnter={pauseAuto}
      onMouseLeave={resumeAuto}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      <div style={{
        display: 'flex', transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: `translateX(${isRTL ? '' : '-'}${current * 100}%)`,
        direction: isRTL ? 'rtl' : 'ltr',
      }}>
        {allSlides.map((slide, idx) => {
          const content = (
            <div style={{
              position: 'relative', zIndex: 1, maxWidth: '560px',
              padding: '48px 40px', width: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: slide.textPosition === 'center' ? 'center' : slide.textPosition === 'right' ? 'flex-end' : 'flex-start',
              textAlign: slide.textPosition === 'center' ? 'center' : slide.textPosition === 'right' ? 'right' : 'left',
            }}>
              {slide.title && (
                <h2 style={{
                  color: slide.imageUrl ? '#fff' : c('text', '#111'),
                  fontSize: '38px', margin: '0 0 12px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1,
                  textShadow: slide.imageUrl ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
                }}>{slide.title}</h2>
              )}
              {slide.subtitle && (
                <p style={{
                  color: slide.imageUrl ? '#fff' : c('textMuted', '#6b7280'),
                  opacity: slide.imageUrl ? 0.95 : 1, margin: '0 0 28px', fontSize: '16px', lineHeight: 1.6,
                  textShadow: slide.imageUrl ? '0 1px 8px rgba(0,0,0,0.3)' : 'none',
                }}>{slide.subtitle}</p>
              )}
              {slide.buttonText && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: slide.imageUrl ? '#fff' : c('primary', '#059669'),
                  color: slide.imageUrl ? c('primary', '#059669') : '#fff',
                  padding: '14px 28px', borderRadius: '12px', fontWeight: 700, fontSize: '15px',
                  transition: 'all 0.25s', boxShadow: slide.imageUrl ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 14px rgba(5,150,105,0.2)',
                }}>
                  {slide.buttonText} <ArrowRight size={18} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
                </span>
              )}
            </div>
          );

          const slideContent = slide.buttonLink ? (
            <Link to={slide.buttonLink} style={{ textDecoration: 'none', display: 'block', width: '100%' }}>{content}</Link>
          ) : content;

          return (
            <div key={idx} style={{
              flex: '0 0 100%', minWidth: '100%', position: 'relative',
              display: 'flex', alignItems: 'center',
              background: slide.imageUrl
                ? `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url(${slide.imageUrl}) center/cover`
                : `linear-gradient(135deg, ${c('surface', '#f9fafb')} 0%, #fff 100%)`,
              border: slide.imageUrl ? 'none' : `1px solid ${c('borderColor', '#e5e7eb')}`,
              minHeight: isSingle ? '320px' : '400px',
            }}>
              {slideContent}
            </div>
          );
        })}
      </div>

      {/* Navigation arrows (multi-slide only) */}
      {!isSingle && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            style={{
              position: 'absolute', [isRTL ? 'right' : 'left']: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
          >
            {isRTL ? <ChevronRight size={20} color="#333" /> : <ChevronLeft size={20} color="#333" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            style={{
              position: 'absolute', [isRTL ? 'left' : 'right']: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
          >
            {isRTL ? <ChevronLeft size={20} color="#333" /> : <ChevronRight size={20} color="#333" />}
          </button>
        </>
      )}

      {/* Dots indicator (multi-slide only) */}
      {!isSingle && (
        <div style={{
          position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px', zIndex: 2,
        }}>
          {allSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); goTo(idx); }}
              style={{
                width: idx === current ? '24px' : '8px', height: '8px', borderRadius: '999px',
                background: idx === current ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', cursor: 'pointer', transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .sf-hero-carousel { min-height: 280px !important; border-radius: 12px !important; }
          .sf-hero-carousel h2 { font-size: 26px !important; }
          .sf-hero-carousel p { font-size: 14px !important; }
        }
      `}</style>
    </div>
  );
}

// ==================== Image Banner Component ====================
function ImageBanner({ settings, c, t, isRTL }) {
  const banners = settings.banners || [];
  const single = { imageUrl: settings.imageUrl || '', linkUrl: settings.linkUrl || '', altText: settings.altText || '', openInNewTab: settings.openInNewTab || false };
  const allBanners = banners.length > 0 ? banners : (single.imageUrl ? [single] : []);

  if (allBanners.length === 0) return null;

  return (
    <div key="image-banner" style={{ marginBottom: '32px' }}>
      {allBanners.length === 1 ? (
        <BannerItem banner={allBanners[0]} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(allBanners.length, 3)}, 1fr)`, gap: '16px' }}>
          {allBanners.map((b, i) => <BannerItem key={i} banner={b} />)}
        </div>
      )}
    </div>
  );

  function BannerItem({ banner }) {
    const img = (
      <img
        src={optimizeImageUrl(banner.imageUrl, { width: 800, quality: 80 })}
        alt={banner.altText || ''}
        loading="lazy"
        style={{ width: '100%', display: 'block', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px', transition: 'transform 0.4s ease' }}
      />
    );
    if (banner.linkUrl) {
      return banner.openInNewTab
        ? <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', overflow: 'hidden', borderRadius: '12px' }} onMouseEnter={e => e.currentTarget.querySelector('img').style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.querySelector('img').style.transform = 'scale(1)'}>{img}</a>
        : <Link to={banner.linkUrl} style={{ display: 'block', overflow: 'hidden', borderRadius: '12px' }} onMouseEnter={e => e.currentTarget.querySelector('img').style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.querySelector('img').style.transform = 'scale(1)'}>{img}</Link>;
    }
    return <div style={{ borderRadius: '12px', overflow: 'hidden' }}>{img}</div>;
  }
}

function FlashSaleSection({ settings, products, currency, colors, onQuickView }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const c = (key, fallback) => colors[key] || fallback;

  useEffect(() => {
    if (!settings.endDate) return;
    const update = () => {
      const diff = new Date(settings.endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [settings.endDate]);

  const isExpired = !settings.endDate || new Date(settings.endDate).getTime() <= Date.now();
  if (isExpired) return null;

  const discountPercent = settings.discountPercent || 20;
  const limit = settings.limit || 4;
  let saleProducts = products;
  if (settings.categoryFilter) {
    saleProducts = saleProducts.filter(p => p.category === settings.categoryFilter);
  }
  saleProducts = saleProducts.slice(0, limit);

  const pad = (n) => String(n).padStart(2, '0');
  const timeBoxes = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hrs', value: timeLeft.hours },
    { label: 'Min', value: timeLeft.minutes },
    { label: 'Sec', value: timeLeft.seconds },
  ];

  return (
    <div key={settings.id} style={{
      marginBottom: '40px',
      background: `linear-gradient(135deg, ${c('primary', '#4f46e5')}, ${c('accent', '#7c3aed')})`,
      borderRadius: '16px', padding: '28px 20px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px' }}>{settings.title || 'Flash Sale'}</h3>
        <p style={{ color: '#fff', opacity: 0.9, margin: '0 0 16px', fontSize: '15px' }}>{settings.subtitle || 'Limited time offer!'}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {timeBoxes.map((tb, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: '10px', padding: '8px 14px', minWidth: '56px',
            }}>
              <p style={{ color: '#fff', fontSize: '22px', fontWeight: 'bold', margin: 0 }}>{pad(tb.value)}</p>
              <p style={{ color: '#fff', opacity: 0.7, fontSize: '10px', margin: 0 }}>{tb.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {saleProducts.map(p => {
          const slug = p.seo?.slug || p._id;
          const salePrice = Math.round(p.basePrice * (1 - discountPercent / 100) * 100) / 100;
          return (
            <div key={p._id} style={{
              background: '#fff', borderRadius: '10px', overflow: 'hidden', position: 'relative',
            }}>
              <Link to={`/store/products/${slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ aspectRatio: '1', background: '#f3f4f6', overflow: 'hidden' }}>
                  {p.images?.[0]?.url ? (
                    <img src={optimizeImageUrl(p.images[0].url, { width: 400, quality: 80 })} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '11px' }}>No image</div>
                  )}
                </div>
                <div style={{ position: 'absolute', top: '6px', left: '6px', background: c('salePriceColor', '#dc2626'), color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px' }}>
                  -{discountPercent}%
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#111', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                  <span style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'line-through', display: 'flex', alignItems: 'center', gap: '2px' }}>{p.basePrice} <SaudiRiyalSymbol size={10} color="#9ca3af" /></span>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', color: c('salePriceColor', '#dc2626'), margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>{salePrice} <SaudiRiyalSymbol size={12} color={c('salePriceColor', '#dc2626')} /></p>
                </div>
              </Link>
              {onQuickView && (
                <button onClick={(e) => { e.preventDefault(); onQuickView(p); }} style={{
                  position: 'absolute', top: '6px', right: '6px', width: '30px', height: '30px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                  <Eye size={14} color={c('primary', '#4f46e5')} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductCard({ product, currency, colors, onQuickView }) {
  const c = (key, fallback) => colors[key] || fallback;
  const slug = product.seo?.slug || product._id;
  const hasSale = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { toast } = useToast();
  const { t } = useI18n();
  const wished = isInWishlist(product._id);
  const [added, setAdded] = useState(false);
  const [hoverImg, setHoverImg] = useState(false);
  const outOfStock = product.inventory?.trackInventory && (product.inventory?.quantity ?? 0) <= 0;
  const rating = product.rating?.average || product.reviewStats?.average || 0;
  const reviewCount = product.rating?.count || product.reviewStats?.count || 0;
  const primary = c('primary', '#4f46e5');
  const secondImg = product.images?.[1]?.url;
  const isNew = (() => {
    const created = new Date(product.createdAt || product.created || Date.now());
    return (Date.now() - created.getTime()) < 14 * 86400000;
  })();

  const handleAdd = (e) => {
    e.preventDefault();
    if (outOfStock) return;
    addItem(product, 1);
    setAdded(true);
    toast(t('addedToCart'));
    setTimeout(() => setAdded(false), 1500);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    toggleWishlist(product);
    toast(wished ? t('removedFromWishlist') : t('addedToWishlist'), 'wishlist');
  };

  return (
    <div className="sf-product-card" style={{
      background: '#fff', border: `1px solid ${c('borderColor', '#e5e7eb')}`,
      borderRadius: '18px', overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column',
      position: 'relative', transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: '100%',
      ['--sf-primary']: primary,
    }}>
      <Link to={`/store/products/${slug}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="sf-card-image" style={{ aspectRatio: '1', background: c('surface', '#f3f4f6'), overflow: 'hidden', position: 'relative' }}
          onMouseEnter={() => setHoverImg(true)} onMouseLeave={() => setHoverImg(false)}
        >
          {product.images?.[0]?.url ? (
            <>
              <img className="sf-card-img" src={optimizeImageUrl(product.images[0].url, { width: 400, quality: 80 })} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.4,0,0.2,1)', opacity: hoverImg && secondImg ? 0 : 1 }} />
              {secondImg && (
                <img className="sf-card-img2" src={optimizeImageUrl(secondImg, { width: 400, quality: 80 })} alt={product.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: hoverImg ? 1 : 0, transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.4,0,0.2,1)', transform: hoverImg ? 'scale(1.08)' : 'scale(1)' }} />
              )}
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c('textMuted', '#9ca3af'), fontSize: '12px' }}>No image</div>
          )}
          {/* Badges */}
          <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {isNew && !outOfStock && (
              <span style={{ background: c('primary', '#4f46e5'), color: '#fff', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>NEW</span>
            )}
            {hasSale && (
              <span style={{ background: c('salePriceColor', '#dc2626'), color: '#fff', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px', boxShadow: '0 2px 8px rgba(220,38,38,0.35)' }}>
                -{Math.round((1 - product.basePrice / product.compareAtPrice) * 100)}%
              </span>
            )}
            {outOfStock && (
              <span style={{ background: '#374151', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>{t('soldOut')}</span>
            )}
          </div>
        </div>
        <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: '14.5px', color: c('text', '#111'), margin: '0 0 8px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '40px' }}>{product.title}</p>
          {rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} size={13} style={{ color: n <= Math.round(rating) ? '#f59e0b' : '#e5e7eb', fill: n <= Math.round(rating) ? '#f59e0b' : '#e5e7eb' }} />
              ))}
              {reviewCount > 0 && <span style={{ fontSize: '11px', color: c('textMuted', '#9ca3af'), marginLeft: '3px' }}>({reviewCount})</span>}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: 'auto' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: c('text', '#111'), display: 'flex', alignItems: 'center', gap: '3px' }}>
              {product.basePrice} <SaudiRiyalSymbol size={14} color={c('text', '#111')} />
            </span>
            {hasSale && (
              <span style={{ fontSize: '13px', color: c('textMuted', '#9ca3af'), textDecoration: 'line-through', display: 'flex', alignItems: 'center', gap: '2px' }}>
                {product.compareAtPrice} <SaudiRiyalSymbol size={11} color={c('textMuted', '#9ca3af')} />
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Hover action buttons (top-right) */}
      <div className="sf-card-actions" style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={handleWishlist} title="Add to wishlist" style={{
          width: '38px', height: '38px', borderRadius: '50%', background: wished ? c('salePriceColor', '#dc2626') : 'rgba(255,255,255,0.96)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', transition: 'transform 0.2s, background 0.2s',
        }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          <Heart size={16} style={{ color: wished ? '#fff' : '#374151', fill: wished ? '#fff' : 'none' }} />
        </button>
        {onQuickView && (
          <button onClick={(e) => { e.preventDefault(); onQuickView(); }} title="Quick view" style={{
            width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.96)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', transition: 'transform 0.2s',
          }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            <Eye size={16} color={primary} />
          </button>
        )}
      </div>

      {/* Slide-up Add to Cart */}
      <div className="sf-card-cart" style={{ padding: '0 16px 16px' }}>
        <button onClick={handleAdd} disabled={outOfStock} style={{
          width: '100%', padding: '11px', borderRadius: '12px', border: 'none', cursor: outOfStock ? 'not-allowed' : 'pointer',
          background: added ? '#059669' : primary, color: '#fff', fontWeight: 700, fontSize: '13.5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: outOfStock ? 0.5 : 1, transition: 'background 0.2s',
        }}>
          {added ? <><Check size={16} /> {t('added')}</> : <><ShoppingCart size={16} /> {outOfStock ? t('soldOut') : t('addToCart')}</>}
        </button>
      </div>
    </div>
  );
}
