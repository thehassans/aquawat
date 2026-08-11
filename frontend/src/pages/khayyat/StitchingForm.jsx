import { useTranslation } from '../../lib/translations.js';
import React, { useCallback, useState, useEffect, useRef } from 'react';

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
const t = (key, opts) => opts?.defaultValue || key;

import { Card, CardBody } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Select, Textarea } from './components/ui/Input';
import { Modal } from './components/ui/Modal';
import DemoBlockedModal from './components/ui/DemoBlockedModal';
import { ArrowLeft, ChevronDown, Calendar, Printer, Users, Image as ImageIcon, Plus, UserPlus, Search, User, X } from 'lucide-react';
import MeasurementAtelierPanel from './components/ui/MeasurementAtelierPanel';
import SARIcon from './components/ui/SARIcon';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { canonicalSaudiMobile, normalizeSaudiPhone } from './utils/saudi';
import ThermalReceipt from '../../components/ui/ThermalReceipt';
import { printThermalElement, getThermalPrinterSettings } from '../../lib/thermalPrinter';

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending / قيد الانتظار', color: 'gray' },
  { value: 'stitching', label: 'Stitching / الخياطة', color: 'blue' },
  { value: 'finishing', label: 'Finishing / التشطيب', color: 'purple' },
  { value: 'laundry', label: 'Laundry / الغسيل', color: 'cyan' },
  { value: 'done', label: 'Done / جاهز', color: 'green' }
];

const THAWB_TYPES = [
  { value: 'saudi', label: 'Saudi', labelAr: 'سعودي', image: '/thawbs/saudi.webp' },
  { value: 'qatari', label: 'Qatari', labelAr: 'قطري', image: '/thawbs/qatari.webp' },
  { value: 'emirati', label: 'Emirati', labelAr: 'إماراتي', image: '/thawbs/emirati.webp' },
  { value: 'kuwaiti', label: 'Kuwaiti', labelAr: 'كويتي', image: '/thawbs/kuwati.webp' },
  { value: 'omani', label: 'Omani', labelAr: 'عماني', image: '/thawbs/omani.webp' },
  { value: 'bahraini', label: 'Bahraini', labelAr: 'بحريني', image: '/thawbs/Bahrini.webp' },
  { value: 'noum', label: 'Noum', labelAr: 'نوم', image: '/thawbs/noum.webp' }
];

const RELATION_TYPES = [
  { value: 'father', label: 'Father / الأب' },
  { value: 'son', label: 'Son / الابن' },
  { value: 'brother', label: 'Brother / الأخ' },
  { value: 'uncle', label: 'Uncle / العم' },
  { value: 'cousin', label: 'Cousin / ابن العم' },
  { value: 'friend', label: 'Friend / صديق' },
  { value: 'other', label: 'Other / آخر' }
];

const StitchingForm = () => {
  
  const { user, tenant } = useSelector(state => state.auth);
  const { language } = useSelector(state => state.ui);
  const { t } = useTranslation(language);
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const printRef = useRef();

  const langKey = (language || 'en').split('-')[0];

  const isDemo = !!user?.isDemoSession;
  const [demoBlockedOpen, setDemoBlockedOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '' });
  const [selectedRelation, setSelectedRelation] = useState(null);
  const selectedRelationIdRef = useRef(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [createdOrders, setCreatedOrders] = useState([]);
  const [printOrder, setPrintOrder] = useState(null);
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false);
  const [customerMeasurementsOpen, setCustomerMeasurementsOpen] = useState(true);
  const [orderForMeasurementsOpen, setOrderForMeasurementsOpen] = useState(false);
  const [orderForDetailsLoading, setOrderForDetailsLoading] = useState(false);
  const [styleCatalog, setStyleCatalog] = useState(null);
  const [styleCatalogLoading, setStyleCatalogLoading] = useState(false);
  const [styleOptionsOpen, setStyleOptionsOpen] = useState(false);
  const [measurementsCatalog, setMeasurementsCatalog] = useState(null);
  const [measurementsCatalogLoading, setMeasurementsCatalogLoading] = useState(false);
  const [thawbTypesCatalog, setThawbTypesCatalog] = useState(null);
  const [thawbTypesCatalogLoading, setThawbTypesCatalogLoading] = useState(false);
  const [fabricColorsCatalog, setFabricColorsCatalog] = useState(null);
  const [fabricColorsCatalogLoading, setFabricColorsCatalogLoading] = useState(false);
  const [fabrics, setFabrics] = useState([]);
  const [fabricsLoading, setFabricsLoading] = useState(false);
  const [selectedEmbroideryDesign, setSelectedEmbroideryDesign] = useState(null);

  const [orderItems, setOrderItems] = useState([]);
  const [familyControlsOpen, setFamilyControlsOpen] = useState(false);
  const [expandedOrderItemId, setExpandedOrderItemId] = useState(null);
  const autoExpandAfterRemoveRef = useRef(false);
  const [addOrderPickerOpen, setAddOrderPickerOpen] = useState(false);

  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [addFamilyType, setAddFamilyType] = useState('son');
  const [familyQuery, setFamilyQuery] = useState('');
  const [familySearching, setFamilySearching] = useState(false);
  const [familyResults, setFamilyResults] = useState([]);
  const [familySelected, setFamilySelected] = useState(null);
  const [familySaving, setFamilySaving] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyPhone, setNewFamilyPhone] = useState('');
  const [formData, setFormData] = useState({
    quantity: 1,
    price: '',
    paidAmount: '',
    description: '',
    dueDate: '',
    status: 'pending',
    thawbType: 'saudi',
    fabricColor: '',
    fabricId: '',
    customFabricName: '',
    rollsUsed: '',
    measurementImage: '',
    measurementImageUpdatedAt: null,
    measurementImageFile: null,
    measurementImagePreview: '',
    removeMeasurementImage: false,
    measurements: {},
    styleOptions: {},
    embroideryDesignId: null
  });

  const filteredCustomers = allCustomers.filter(customer => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    const searchPhone = canonicalSaudiMobile(customerSearch);
    return (customer.nameI18n?.[langKey] || customer.name || '')?.toLowerCase().includes(search) || 
           customer.phone?.includes(customerSearch) ||
           (customer.customerCode || '')?.toLowerCase().includes(search) ||
           (customer.khayyatReceiptNumbers || '')?.toLowerCase().includes(search) ||
           (!!searchPhone && canonicalSaudiMobile(customer.phone) === searchPhone);
  });

  useEffect(() => {
    fetchAllCustomers();
    fetchStyleCatalog();
    fetchMeasurementsCatalog();
    fetchStyleCatalog();
    fetchFabrics();
    if (isEdit) fetchStitching();
  }, [id]);

  const resolveUploadsUrl = useCallback((src) => {
    if (!src) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (!src.startsWith('/uploads/')) return src;
    const baseUrl = api?.defaults?.baseURL;
    if (!baseUrl || typeof baseUrl !== 'string') return src;
    try {
      if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
        return `${new URL(baseUrl).origin}${src}`;
      }
    } catch (e) {
      return src;
    }
    return src;
  }, [api, searchParams]);

  const buildUploadedImageSrc = useCallback((src, updatedAt) => {
    const resolved = resolveUploadsUrl(src);
    if (!resolved) return '';
    const separator = resolved.includes('?') ? '&' : '?';
    return updatedAt ? `${resolved}${separator}v=${updatedAt}` : resolved;
  }, [resolveUploadsUrl]);

  const revokeObjectUrl = useCallback((src) => {
    if (src && typeof src === 'string' && src.startsWith('blob:')) {
      URL.revokeObjectURL(src);
    }
  }, []);

  const buildMultipartPayload = useCallback((payload, measurementImageFile, removeMeasurementImage = false) => {
    const multipart = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'measurements' || key === 'styleOptions') {
        multipart.append(key, JSON.stringify(value || {}));
        return;
      }
      if (value === null) {
        multipart.append(key, '');
        return;
      }
      multipart.append(key, String(value));
    });
    if (measurementImageFile) multipart.append('measurementImage', measurementImageFile);
    if (removeMeasurementImage) multipart.append('removeMeasurementImage', 'true');
    return multipart;
  }, []);

  const fetchAllCustomers = async () => {
    try {
      const response = await api.get('/khayyat/customers', { params: { limit: 2000 } });
      const data = response.data;
      setAllCustomers(Array.isArray(data) ? data : data.customers || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCustomerDetails = useCallback(async (customerId) => {
    if (!customerId) return;
    try {
      setCustomerDetailsLoading(true);
      const resp = await api.get(`/khayyat/customers/${customerId}`);
      const fetched = resp.data?.customer || null;
      if (!fetched) return;
      setSelectedCustomer(fetched);
      setSelectedRelation(null);
      selectedRelationIdRef.current = null;
      setCustomerMeasurementsOpen(true);
      setOrderForMeasurementsOpen(false);

      const shouldFillMeasurements = (searchParams.get('tutorial') || '') === '1' && (searchParams.get('fillMeasurements') || '') === '1';
      const defaults = {
        length: 10,
        shoulderWidth: 10,
        chest: 10,
        waist: 10,
        hips: 10,
        sleeveLength: 10,
        bicep: 10,
        forearm: 10,
        neck: 10,
        wrist: 10,
        cuffWidth: 10,
        expansion: 10,
        armhole: 10,
        bottom: 10
      };

      let nextMeasurements = fetched.measurements || {};
      if (shouldFillMeasurements) {
        const merged = { ...defaults, ...(nextMeasurements || {}) };
        Object.keys(defaults).forEach((k) => {
          const v = merged[k];
          if (v === null || v === undefined || v === '') merged[k] = 10;
        });
        nextMeasurements = merged;
      }
      setFormData((prev) => ({
        ...prev,
        measurements: nextMeasurements
      }));
      return fetched;
    } catch (e) {

    } finally {
      setCustomerDetailsLoading(false);
    }
  }, [api, searchParams]);

  useEffect(() => {
    const preselectCustomer = async () => {
      if (isEdit) return;
      const customerId = searchParams.get('customerId');

      const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
      const phoneVariants = (digits) => {
        const raw = normalizePhone(digits);
        const set = new Set();
        if (raw) set.add(raw);
        if (raw.startsWith('0') && raw.length === 10) {
          set.add(`966${raw.slice(1)}`);
        }
        if (raw.startsWith('966') && raw.length >= 12) {
          set.add(`0${raw.slice(3)}`);
        }
        return Array.from(set);
      };
      const tutorial = (searchParams.get('tutorial') || '') === '1';
      const customerPhone = tutorial ? normalizePhone(searchParams.get('customerPhone')) : '';
      const customerPhoneOptions = tutorial ? phoneVariants(customerPhone) : [];

      if (customerId) {
        if (selectedCustomer?._id === customerId) return;

        const fromList = (allCustomers || []).find((c) => c?._id === customerId);
        if (fromList) {
          await loadCustomerDetails(fromList._id);
          return;
        }

        try {
          await loadCustomerDetails(customerId);
        } catch (e) {

        }
        return;
      }

      if (customerPhone) {
        const already = normalizePhone(selectedCustomer?.phone);
        if (already && customerPhoneOptions.some((opt) => already === opt || already.endsWith(opt) || already.includes(opt))) return;

        const match = (allCustomers || []).find((c) => {
          const p = normalizePhone(c?.phone);
          if (!p) return false;
          return customerPhoneOptions.some((opt) => p === opt || p.endsWith(opt) || p.includes(opt));
        });

        if (match?._id) {
          setCustomerSearch(searchParams.get('customerPhone') || '');
          await loadCustomerDetails(match._id);
          return;
        }

        setCustomerSearch(searchParams.get('customerPhone') || '');
        setDropdownOpen(true);
      }
    };

    preselectCustomer();
  }, [allCustomers, isEdit, loadCustomerDetails, searchParams, selectedCustomer?._id]);

  useEffect(() => {
    const preselectEmbroideryDesign = async () => {
      if (isEdit) return;
      const designId = searchParams.get('embroideryDesignId');
      if (!designId) return;
      if (formData.embroideryDesignId === designId) return;

      try {
        const resp = await api.get(`/khayyat/embroidery-designs/${designId}`);
        const fetched = resp.data?.design || null;
        if (fetched) {
          setSelectedEmbroideryDesign(fetched);
          setFormData((prev) => ({ ...prev, embroideryDesignId: fetched._id }));
        }
      } catch (e) {

      }
    };

    preselectEmbroideryDesign();
  }, [api, formData.embroideryDesignId, isEdit, searchParams]);

  const CATEGORIES_SORT = {
    collar: 0,
    bain: 1,
    cuff: 2,
    pocket: 3,
    buttons: 4,
    embroidery: 5,
    fabricMaterial: 6,
    fabricColor: 7,
    thawbType: 8,
    measurements: 9
  };

  const fetchStyleCatalog = async () => {
    try {
      setStyleCatalogLoading(true);
      const response = await api.get('/khayyat/customizations');
      const items = response.data?.customizations || [];
      
      const groupsMap = {};
      const colorsCat = [];
      const thawbCat = [];
      const fabricMatCat = [];

      items.forEach(item => {
        if (item.category === 'fabricColor') {
          if (item.isActive) {
            colorsCat.push({ key: item._id, name: item.nameEn, nameI18n: { en: item.nameEn, ar: item.nameAr }, hex: item.image || '#e5e7eb', sortOrder: item.sortOrder || 0 });
          }
        } else if (item.category === 'thawbType') {
          if (item.isActive) {
            thawbCat.push({ key: item._id, name: item.nameEn, nameI18n: { en: item.nameEn, ar: item.nameAr }, image: item.image, sortOrder: item.sortOrder || 0 });
          }
        } else if (item.category === 'fabricMaterial') {
          if (item.isActive) {
            fabricMatCat.push({ key: item._id, name: item.nameEn, nameI18n: { en: item.nameEn, ar: item.nameAr }, image: item.image, sortOrder: item.sortOrder || 0 });
          }
        } else {
          if (!groupsMap[item.category]) {
            groupsMap[item.category] = {
              key: item.category,
              name: item.category,
              enabled: true,
              sortOrder: CATEGORIES_SORT[item.category] || 0,
              options: []
            };
          }
          if (item.isActive) {
            groupsMap[item.category].options.push({
              key: item._id,
              name: item.nameEn,
              nameI18n: { en: item.nameEn, ar: item.nameAr },
              image: item.image,
              sortOrder: item.sortOrder || 0,
              extraPrice: item.extraPrice || 0
            });
          }
        }
      });
      
      if (Object.keys(groupsMap).length > 0) {
        setStyleCatalog({ groups: Object.values(groupsMap) });
      } else {
        setStyleCatalog(null);
      }

      if (colorsCat.length > 0) {
        setFabricColorsCatalog({ colors: colorsCat });
      } else {
        setFabricColorsCatalog(null);
      }

      if (thawbCat.length > 0) {
        setThawbTypesCatalog({ types: thawbCat });
      } else {
        setThawbTypesCatalog(null);
      }
      
      // If we ever want to use fabricMaterial from customizations instead of fabrics
      // we can set it here if needed. But for now we just load it.

    } catch (error) {
      setStyleCatalog(null);
    }
    setStyleCatalogLoading(false);
  };

  const fetchMeasurementsCatalog = async () => {
    try {
      setMeasurementsCatalogLoading(true);
      const response = await api.get('/khayyat/settings/measurements-catalog');
      setMeasurementsCatalog(response.data?.catalog || null);
    } catch (error) {
      setMeasurementsCatalog(null);
    }
    setMeasurementsCatalogLoading(false);
  };

  const fetchFabrics = async () => {
    try {
      setFabricsLoading(true);
      const res = await api.get('/khayyat/fabrics');
      setFabrics(Array.isArray(res.data?.fabrics) ? res.data.fabrics : []);
    } catch (e) {
      setFabrics([]);
    }
    setFabricsLoading(false);
  };

  const fetchStitching = async () => {
    try {
      const response = await api.get(`/khayyat/stitchings/${id}`);
      const stitch = response.data.stitching || response.data;
      const customerIdToLoad = typeof stitch.customerId === 'object' ? stitch.customerId?._id : stitch.customerId;
      setSelectedCustomer(stitch.customerId);
      if (customerIdToLoad) {
        try {
          const custResp = await api.get(`/khayyat/customers/${customerIdToLoad}`);
          const fetched = custResp.data?.customer || null;
          if (fetched) setSelectedCustomer(fetched);
        } catch (e) {

        }
      }
      const designId = typeof stitch.embroideryDesignId === 'object' ? stitch.embroideryDesignId?._id : stitch.embroideryDesignId;
      const designSnap = stitch.embroideryDesign || {};
      setSelectedEmbroideryDesign(designId ? {
        _id: designId,
        name: designSnap.name || '',
        image: designSnap.image || null,
        imageUpdatedAt: designSnap.imageUpdatedAt || null
      } : null);
      setFormData({
        quantity: stitch.quantity,
        price: stitch.price || '',
        paidAmount: stitch.paidAmount || '',
        description: stitch.description || '',
        dueDate: stitch.dueDate ? new Date(stitch.dueDate).toISOString().split('T')[0] : '',
        status: stitch.status || 'pending',
        thawbType: stitch.thawbType || 'saudi',
        fabricColor: stitch.fabricColor || '',
        fabricId: (typeof stitch.fabricId === 'object' ? stitch.fabricId?._id : stitch.fabricId) || '',
        customFabricName: stitch.customFabricName || '',
        rollsUsed: (stitch.rollsUsed !== undefined && stitch.rollsUsed !== null) ? String(stitch.rollsUsed) : '',
        measurementImage: stitch.measurementImage || '',
        measurementImageUpdatedAt: stitch.measurementImageUpdatedAt || null,
        measurementImageFile: null,
        measurementImagePreview: buildUploadedImageSrc(stitch.measurementImage, stitch.measurementImageUpdatedAt),
        removeMeasurementImage: false,
        measurements: stitch.measurements || {},
        styleOptions: stitch.styleOptions || {},
        embroideryDesignId: designId || null
      });

      const relId = typeof stitch.relationId === 'object' ? stitch.relationId?._id : stitch.relationId;
      if (relId) {
        setSelectedRelation({
          _id: relId,
          name: stitch.relationName || stitch.relationId?.nameI18n?.[langKey] || stitch.relationId?.name || '',
          phone: stitch.relationId?.phone || '',
          type: stitch.relationType || '',
          measurements: stitch.measurements || {},
          raw: null
        });
        selectedRelationIdRef.current = String(relId);
        setCustomerMeasurementsOpen(false);
        setOrderForMeasurementsOpen(true);
      } else {
        setSelectedRelation(null);
        selectedRelationIdRef.current = null;
        setCustomerMeasurementsOpen(true);
        setOrderForMeasurementsOpen(false);
      }
    } catch (error) {
      toast.error('Failed to load');
      navigate('/app/dashboard/khayyat/stitchings');
    }
  };

  const handleCustomerSelect = async (customer) => {
    setDropdownOpen(false);
    setQuickCustomerOpen(false);
    setQuickCustomer({ name: '', phone: '' });
    setOrderItems([]);
    setFamilyControlsOpen(false);
    setExpandedOrderItemId(null);
    setSelectedRelation(null);
    selectedRelationIdRef.current = null;
    await loadCustomerDetails(customer?._id);
  };

  const normalizeRelationForUi = (rel) => {
    const ref = rel?.customerId && typeof rel.customerId === 'object' ? rel.customerId : null;
    const id = ref?._id || rel?.customerId || rel?._id || null;
    const type = rel?.relationType || rel?.type || '';
    const name = ref?.nameI18n?.[langKey] || ref?.name || rel?.customerName || rel?.name || '';
    const phone = ref?.phone || rel?.customerPhone || rel?.phone || '';
    const measurements = ref?.measurements || rel?.measurements || {};

    return {
      _id: id,
      name,
      phone,
      type,
      measurements,
      raw: rel
    };
  };

  const normalizeRelationForSave = (rel) => {
    const ref = rel?.customerId && typeof rel.customerId === 'object' ? rel.customerId : null;
    const id = ref?._id || rel?.customerId || rel?._id || null;
    const relationType = rel?.relationType || rel?.type || '';
    const customerName = ref?.nameI18n?.[langKey] || ref?.name || rel?.customerName || rel?.name || '';
    const customerPhone = ref?.phone || rel?.customerPhone || rel?.phone || '';
    return {
      customerId: id,
      customerName,
      customerPhone,
      relationType
    };
  };

  const openAddFamily = (prefillType = 'son') => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setAddFamilyType(prefillType);
    setFamilyQuery('');
    setFamilySearching(false);
    setFamilyResults([]);
    setFamilySelected(null);
    setNewFamilyName('');
    setNewFamilyPhone('');
    setAddFamilyOpen(true);
  };

  useEffect(() => {
    if (!addFamilyOpen) return;

    const q = String(familyQuery || '').trim();
    if (!q) {
      setFamilyResults([]);
      setFamilySearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setFamilySearching(true);
        const resp = await api.get(`/khayyat/customers/search?q=${encodeURIComponent(q)}`);
        const list = Array.isArray(resp.data?.customers)
          ? resp.data.customers
          : Array.isArray(resp.data)
            ? resp.data
            : [];
        const existingIds = new Set((selectedCustomer?.relations || []).map((r) => String(normalizeRelationForSave(r)?.customerId || '')));
        const filtered = list.filter((c) => String(c?._id) !== String(selectedCustomer?._id) && !existingIds.has(String(c?._id)));
        setFamilyResults(filtered);
      } catch (e) {
        setFamilyResults([]);
      }
      setFamilySearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [addFamilyOpen, api, familyQuery, selectedCustomer?._id, selectedCustomer?.relations]);

  const saveFamilyMember = async () => {
    if (!selectedCustomer?._id) return;
    if (!addFamilyType) return;
    if (familySaving) return;

    try {
      setFamilySaving(true);

      let target = familySelected;

      if (!target?._id) {
        const nm = String(newFamilyName || '').trim();
        const ph = normalizeSaudiPhone(newFamilyPhone);
        if (!nm || !ph) {
          toast.error('Enter name and phone');
          setFamilySaving(false);
          return;
        }
        const created = await api.post('/khayyat/customers', { name: nm, phone: ph });
        target = created.data?.customer || created.data;
      }

      if (!target?._id) {
        toast.error('Select a customer');
        setFamilySaving(false);
        return;
      }

      const next = (selectedCustomer?.relations || [])
        .map(normalizeRelationForSave)
        .filter((r) => r?.customerId);
      next.push({
        customerId: target._id,
        customerName: target?.nameI18n?.[langKey] || target?.name || '',
        customerPhone: target?.phone || '',
        relationType: addFamilyType
      });

      await api.put(`/khayyat/customers/${selectedCustomer._id}`, { relations: next });
      setAddFamilyOpen(false);

      await loadCustomerDetails(selectedCustomer._id);
      handleRelationSelect({ customerId: target, relationType: addFamilyType });
    } catch (e) {
      toast.error(e.response?.data?.error || 'Operation failed');
    }

    setFamilySaving(false);
  };

  const loadOrderForMeasurements = useCallback(async (relationCustomerId) => {
    if (!relationCustomerId) return {};
    try {
      setOrderForDetailsLoading(true);
      const resp = await api.get(`/khayyat/customers/${relationCustomerId}`);
      const fetched = resp.data?.customer || null;
      return fetched?.measurements || {};
    } catch (e) {
      return {};
    } finally {
      setOrderForDetailsLoading(false);
    }
  }, [api]);

  const handleRelationSelect = (relation) => {
    const normalized = normalizeRelationForUi(relation);
    setSelectedRelation(normalized);
    selectedRelationIdRef.current = normalized?._id ? String(normalized._id) : null;
    setCustomerMeasurementsOpen(false);
    setOrderForMeasurementsOpen(true);
    setFormData((prev) => ({
      ...prev,
      measurements: normalized.measurements || {}
    }));
    if (normalized?._id) {
      loadOrderForMeasurements(normalized._id).then((m) => {
        if (String(selectedRelationIdRef.current || '') !== String(normalized._id)) return;
        if (m && Object.keys(m).length > 0) {
          setSelectedRelation((p) => {
            if (!p) return p;
            if (String(p._id) !== String(normalized._id)) return p;
            return { ...p, measurements: m };
          });
          setFormData((prev) => ({ ...prev, measurements: m }));
        }
      });
    }
  };

  const clearRelation = () => {
    setSelectedRelation(null);
    selectedRelationIdRef.current = null;
    setCustomerMeasurementsOpen(true);
    setOrderForMeasurementsOpen(false);
    // Restore customer's measurements
    setFormData((prev) => ({
      ...prev,
      measurements: selectedCustomer?.measurements || {}
    }));
  };

  const addOrderForTarget = async (relationOrNull) => {
    if (!selectedCustomer?._id) return;

    const isSelf = !relationOrNull;
    const personKey = isSelf ? 'self' : String(relationOrNull?._id || '');
    const personName = isSelf
      ? (selectedCustomer?.nameI18n?.[langKey] || selectedCustomer?.name || '')
      : (relationOrNull?.name || '');

    if (!personName || !personKey) return;

    let measurementsSnap = isSelf
      ? { ...(selectedCustomer?.measurements || {}) }
      : { ...(relationOrNull?.measurements || {}) };

    if (!isSelf && Object.keys(measurementsSnap || {}).length === 0) {
      const fetched = await loadOrderForMeasurements(relationOrNull?._id);
      measurementsSnap = { ...(fetched || {}) };
    }

    const newId = `${personKey}-${Date.now()}`;
    const existing = orderItems.find((x) => String(x.personKey) === String(personKey));
    setExpandedOrderItemId(existing?.id || newId);

    setOrderItems((prev) => {
      const idx = prev.findIndex((x) => String(x.personKey) === String(personKey));
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          quantity: (Number(next[idx]?.quantity) || 1) + 1
        };
        return next;
      }
      return prev.concat({
        id: newId,
        personKey,
        relationId: isSelf ? null : (relationOrNull?._id || null),
        relationName: isSelf ? null : (relationOrNull?.name || null),
        relationType: isSelf ? null : (relationOrNull?.type || null),
        orderFor: personName,
        quantity: 1,
        price: '',
        paidAmount: '',
        measurementImage: '',
        measurementImageUpdatedAt: null,
        measurementImageFile: null,
        measurementImagePreview: '',
        removeMeasurementImage: false,
        measurements: measurementsSnap
      });
    });

    setFamilyControlsOpen(false);
  };

  const addCurrentToOrder = () => addOrderForTarget(selectedRelation);

  const updateOrderItem = (id, patch) => {
    setOrderItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const redistributeBatchPrices = (rawTotal) => {
    const total = Math.max(0, Number(rawTotal) || 0);
    setOrderItems((prev) => {
      const items = Array.isArray(prev) ? prev : [];
      if (items.length === 0) return prev;

      const weights = items.map((it) => {
        const p = Number(it?.price);
        const q = Number(it?.quantity) || 0;
        if (Number.isFinite(p) && p > 0) return p;
        return Math.max(0, q);
      });
      const sumW = weights.reduce((s, w) => s + (Number(w) || 0), 0);
      const toMoneyString = (n) => String(Number((Number(n) || 0).toFixed(2)));

      let distributed = 0;
      return items.map((it, idx) => {
        if (sumW <= 0) {
          return { ...it, price: '0' };
        }
        if (idx === items.length - 1) {
          const rest = Number((total - distributed).toFixed(2));
          return { ...it, price: toMoneyString(rest) };
        }
        const share = total * ((Number(weights[idx]) || 0) / sumW);
        const rounded = Number(share.toFixed(2));
        distributed += rounded;
        return { ...it, price: toMoneyString(rounded) };
      });
    });
  };

  const updateOrderItemMeasurement = (id, key, value) => {
    setOrderItems((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      const parsed = value ? parseFloat(value) : '';
      return {
        ...x,
        measurements: {
          ...(x.measurements || {}),
          [key]: parsed
        }
      };
    }));
  };

  const handleMeasurementImageChange = (file) => {
    const currentPreview = formData.measurementImagePreview;
    if (currentPreview) revokeObjectUrl(currentPreview);
    
    setFormData((prev) => {
      if (!file) {
        return {
          ...prev,
          measurementImageFile: null,
          measurementImagePreview: prev.measurementImage ? buildUploadedImageSrc(prev.measurementImage, prev.measurementImageUpdatedAt) : '',
          removeMeasurementImage: false
        };
      }
      return {
        ...prev,
        measurementImageFile: file,
        measurementImagePreview: URL.createObjectURL(file),
        removeMeasurementImage: false
      };
    });
  };

  const handleMeasurementImageRemove = () => {
    const currentPreview = formData.measurementImagePreview;
    if (currentPreview) revokeObjectUrl(currentPreview);
    
    setFormData((prev) => {
      return {
        ...prev,
        measurementImageFile: null,
        measurementImage: '',
        measurementImageUpdatedAt: null,
        measurementImagePreview: '',
        removeMeasurementImage: true
      };
    });
  };

  const updateOrderItemMeasurementImage = (id, file) => {
    setOrderItems((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      if (x.measurementImagePreview) revokeObjectUrl(x.measurementImagePreview);
      if (!file) {
        return {
          ...x,
          measurementImageFile: null,
          measurementImagePreview: x.measurementImage ? buildUploadedImageSrc(x.measurementImage, x.measurementImageUpdatedAt) : '',
          removeMeasurementImage: false
        };
      }
      return {
        ...x,
        measurementImageFile: file,
        measurementImagePreview: URL.createObjectURL(file),
        removeMeasurementImage: false
      };
    }));
  };

  const removeOrderItemMeasurementImage = (id) => {
    setOrderItems((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      if (x.measurementImagePreview) revokeObjectUrl(x.measurementImagePreview);
      return {
        ...x,
        measurementImageFile: null,
        measurementImage: '',
        measurementImageUpdatedAt: null,
        measurementImagePreview: '',
        removeMeasurementImage: true
      };
    }));
  };

  const removeOrderItem = (id) => {
    const target = orderItems.find((x) => x.id === id);
    if (target?.measurementImagePreview) revokeObjectUrl(target.measurementImagePreview);
    if (String(expandedOrderItemId || '') === String(id)) {
      autoExpandAfterRemoveRef.current = true;
      setExpandedOrderItemId(null);
    }
    setOrderItems((prev) => prev.filter((x) => x.id !== id));
  };

  useEffect(() => {
    if (orderItems.length === 0) {
      if (expandedOrderItemId !== null) setExpandedOrderItemId(null);
      autoExpandAfterRemoveRef.current = false;
      return;
    }
    if (expandedOrderItemId === null) {
      if (autoExpandAfterRemoveRef.current) {
        autoExpandAfterRemoveRef.current = false;
        setExpandedOrderItemId(orderItems[orderItems.length - 1]?.id || null);
      }
      return;
    }
    if (orderItems.some((x) => String(x.id) === String(expandedOrderItemId))) return;
    setExpandedOrderItemId(orderItems[orderItems.length - 1]?.id || null);
  }, [orderItems, expandedOrderItemId]);

  const computeAllocations = (items, field, overrideTotal) => {
    const explicit = new Map();
    let sumExplicit = 0;
    let sumQtyEmpty = 0;

    items.forEach((it) => {
      const v = String(it?.[field] ?? '').trim();
      if (v === '') {
        sumQtyEmpty += Number(it?.quantity) || 0;
        return;
      }
      const num = Number(v);
      if (!Number.isFinite(num) || num < 0) {
        sumQtyEmpty += Number(it?.quantity) || 0;
        return;
      }
      explicit.set(it.id, num);
      sumExplicit += num;
    });

    const total = overrideTotal;
    if (total === null) {
      const map = new Map();
      items.forEach((it) => map.set(it.id, explicit.get(it.id) ?? 0));
      return map;
    }

    const remaining = Math.max(0, total - sumExplicit);
    const map = new Map();
    let distributed = 0;

    const emptyItems = items.filter((it) => !explicit.has(it.id));
    emptyItems.forEach((it, idx) => {
      if (sumQtyEmpty <= 0) {
        map.set(it.id, 0);
        return;
      }
      if (idx === emptyItems.length - 1) {
        map.set(it.id, Number((remaining - distributed).toFixed(2)));
        return;
      }
      const share = remaining * ((Number(it?.quantity) || 0) / sumQtyEmpty);
      const rounded = Number(share.toFixed(2));
      distributed += rounded;
      map.set(it.id, rounded);
    });

    items.forEach((it) => map.set(it.id, explicit.get(it.id) ?? map.get(it.id) ?? 0));
    return map;
  };

  const allocateRollsUsed = (items, totalRolls) => {
    const total = Number(totalRolls) || 0;
    const sumQty = items.reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
    const map = new Map();
    if (total <= 0 || sumQty <= 0) {
      items.forEach((it) => map.set(it.id, 0));
      return map;
    }

    let used = 0;
    items.forEach((it, idx) => {
      if (idx === items.length - 1) {
        map.set(it.id, Number((total - used).toFixed(2)));
        return;
      }
      const share = total * ((Number(it?.quantity) || 0) / sumQty);
      const rounded = Number(share.toFixed(2));
      used += rounded;
      map.set(it.id, rounded);
    });
    return map;
  };

  const computePaidAllocationsByPrice = (items, totalPaid, priceAlloc) => {
    const total = Math.max(0, Number(totalPaid) || 0);
    const weights = items.map((it) => {
      const p = Number(priceAlloc?.get(it.id)) || 0;
      const q = Number(it?.quantity) || 0;
      return { id: it.id, price: p, qty: q };
    });

    const sumPrice = weights.reduce((s, x) => s + (Number(x.price) || 0), 0);
    const usePrice = sumPrice > 0;
    const denom = usePrice ? sumPrice : weights.reduce((s, x) => s + (Number(x.qty) || 0), 0);
    const map = new Map();

    if (denom <= 0) {
      items.forEach((it) => map.set(it.id, 0));
      return map;
    }

    let distributed = 0;
    weights.forEach((w, idx) => {
      if (idx === weights.length - 1) {
        map.set(w.id, Number((total - distributed).toFixed(2)));
        return;
      }
      const weight = usePrice ? w.price : w.qty;
      const share = total * ((Number(weight) || 0) / denom);
      const rounded = Number(share.toFixed(2));
      distributed += rounded;
      map.set(w.id, rounded);
    });

    return map;
  };

  const handlePrintLabel = async (orderToPrint) => {
    const order = orderToPrint || createdOrder || createdOrders?.[0];
    if (!order) return;
    setPrintOrder(order);
  };

  const handlePrintFamilySummary = async () => {
    const orders = (createdOrders && createdOrders.length > 0) ? createdOrders : [];
    if (orders.length === 0 || !selectedCustomer) return;

    const aggregatedOrder = {
      _id: orders[0]._id, // for barcode
      createdAt: orders[0].createdAt,
      receiptNumber: orders[0].receiptNumber || orders[0].orderNumber || orders[0]._id.slice(-8),
      customerName: selectedCustomer.nameI18n?.[langKey] || selectedCustomer.name || orders[0].customerName,
      customerPhone: selectedCustomer.phone || orders[0].customerPhone,
      price: orders.reduce((s, o) => s + (Number(o?.price) || 0), 0),
      paidAmount: orders.reduce((s, o) => s + (Number(o?.paidAmount) || 0), 0),
      quantity: orders.reduce((s, o) => s + (Number(o?.quantity) || 0), 0),
      items: orders.map(o => ({
        nameEn: `Tailoring Order (${o.orderFor || 'Member'})`,
        nameAr: `طلب خياطة (${o.orderFor || 'الفرد'})`,
        quantity: o.quantity || 1,
        unitPrice: o.price || 0,
        total: o.price || 0
      }))
    };
    
    setPrintOrder(aggregatedOrder);
  };

  const handleMeasurementChange = (field, value) => {
    setFormData({
      ...formData,
      measurements: {
        ...formData.measurements,
        [field]: value ? parseFloat(value) : ''
      }
    });
  };

  const handleStyleOptionChange = (group, value) => {
    const current = { ...(formData.styleOptions || {}) };
    if (!value) {
      delete current[group];
    } else {
      current[group] = value;
    }
    setFormData({
      ...formData,
      styleOptions: current
    });
  };

  const activeCustomerName = selectedCustomer?.nameI18n?.[langKey] || selectedCustomer?.name || quickCustomer.name || '';
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    const quickName = String(quickCustomer.name || '').trim();
    const quickPhone = normalizeSaudiPhone(quickCustomer.phone);

    if (!selectedCustomer && !quickCustomerOpen) {
      toast.error('Select a customer or use quick customer');
      return;
    }
    if (!selectedCustomer && quickCustomerOpen && (!quickName || !quickPhone)) {
      toast.error('Enter customer name and phone');
      return;
    }
    setLoading(true);

    try {
      const rollsUsedValue = formData.rollsUsed === '' ? 0 : Number(formData.rollsUsed);
      if (rollsUsedValue !== undefined && (!Number.isFinite(rollsUsedValue) || rollsUsedValue < 0)) {
        toast.error('Invalid rolls used');
        setLoading(false);
        return;
      }

      if (!formData.fabricId && !String(formData.customFabricName || '').trim() && Number(rollsUsedValue) > 0) {
        toast.error('Select fabric or enter fabric name');
        setLoading(false);
        return;
      }

      if (isEdit) {
        const data = {
          customerId: selectedCustomer?._id || null,
          customerName: selectedCustomer?.name || quickName,
          customerPhone: selectedCustomer?.phone || quickPhone,
          relationId: selectedRelation?._id || null,
          relationName: selectedRelation?.name || null,
          relationType: selectedRelation?.type || null,
          orderFor: selectedRelation ? selectedRelation.name : (selectedCustomer?.name || quickName),
          quantity: formData.quantity,
          price: parseFloat(formData.price) || 0,
          paidAmount: parseFloat(formData.paidAmount) || 0,
          description: formData.description,
          dueDate: formData.dueDate,
          status: formData.status,
          thawbType: formData.thawbType,
          fabricColor: formData.fabricColor || null,
          fabricId: formData.fabricId ? formData.fabricId : null,
          customFabricName: String(formData.customFabricName || '').trim(),
          rollsUsed: rollsUsedValue,
          measurements: formData.measurements,
          styleOptions: formData.styleOptions,
          embroideryDesignId: formData.embroideryDesignId || null
        };
        const multipartData = buildMultipartPayload(data, formData.measurementImageFile, formData.removeMeasurementImage);
        await api.put(`/khayyat/stitchings/${id}`, multipartData);
        toast.success('Updated');
        navigate('/app/dashboard/khayyat/stitchings');
      } else {
        if (batchMode) {
          const items = (orderItems || [])
            .map((it) => ({
              ...it,
              quantity: Math.max(1, Number(it?.quantity) || 1)
            }))
            .filter((it) => !!it.orderFor);

          if (items.length === 0) {
            toast.error('Add at least 1 family member');
            setLoading(false);
            return;
          }

          const priceAlloc = computeAllocations(items, 'price', null);
          const paidAlloc = computePaidAllocationsByPrice(items, totalPaidOverride === null ? 0 : totalPaidOverride, priceAlloc);
          const rollsAlloc = allocateRollsUsed(items, rollsUsedValue);

          const created = [];
          for (const it of items) {
            const data = {
              customerId: selectedCustomer?._id || null,
              customerName: selectedCustomer?.name || quickName,
              customerPhone: selectedCustomer?.phone || quickPhone,
              relationId: it.relationId || null,
              relationName: it.relationName || null,
              relationType: it.relationType || null,
              orderFor: it.orderFor,
              quantity: Math.max(1, Number(it.quantity) || 1),
              price: Number(priceAlloc.get(it.id)) || 0,
              paidAmount: Number(paidAlloc.get(it.id)) || 0,
              description: formData.description,
              dueDate: formData.dueDate,
              status: formData.status,
              thawbType: formData.thawbType,
              fabricColor: formData.fabricColor || null,
              fabricId: formData.fabricId ? formData.fabricId : null,
              customFabricName: String(formData.customFabricName || '').trim(),
              rollsUsed: Number(rollsAlloc.get(it.id)) || 0,
              measurements: it.measurements || {},
              styleOptions: formData.styleOptions,
              embroideryDesignId: formData.embroideryDesignId || null
            };

            const multipartData = buildMultipartPayload(data, it.measurementImageFile, it.removeMeasurementImage);
            const response = await api.post('/khayyat/stitchings', multipartData);
            const order = response.data?.stitching || response.data;
            if (response.data?.customer) setSelectedCustomer(response.data.customer);
            created.push(order);
          }

          setCreatedOrders(created);
          setCreatedOrder(created[0] || null);
          toast.success(t('ordersCreatedMultiple', { defaultValue: 'Orders created! You can print labels now.' }));
        } else {
          const data = {
            customerId: selectedCustomer?._id || null,
            customerName: selectedCustomer?.name || quickName,
            customerPhone: selectedCustomer?.phone || quickPhone,
            relationId: selectedRelation?._id || null,
            relationName: selectedRelation?.name || null,
            relationType: selectedRelation?.type || null,
            orderFor: selectedRelation ? selectedRelation.name : (selectedCustomer?.name || quickName),
            quantity: formData.quantity,
            price: parseFloat(formData.price) || 0,
            paidAmount: parseFloat(formData.paidAmount) || 0,
            description: formData.description,
            dueDate: formData.dueDate,
            status: formData.status,
            thawbType: formData.thawbType,
            fabricColor: formData.fabricColor || null,
            fabricId: formData.fabricId ? formData.fabricId : null,
            customFabricName: String(formData.customFabricName || '').trim(),
            rollsUsed: rollsUsedValue,
            measurements: formData.measurements,
            styleOptions: formData.styleOptions,
            embroideryDesignId: formData.embroideryDesignId || null
          };
          const multipartData = buildMultipartPayload(data, formData.measurementImageFile, formData.removeMeasurementImage);
          const response = await api.post('/khayyat/stitchings', multipartData);
          const order = response.data?.stitching || response.data;
          if (response.data?.customer) setSelectedCustomer(response.data.customer);
          setCreatedOrders([]);
          setCreatedOrder(order);
          toast.success(t('ordersCreatedSingle', { defaultValue: 'Order created! You can print the label now.' }));
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed');
    }
    setLoading(false);
  };

  const fallbackMeasurementFields = [
    { key: 'length', label: (language === 'ar' ? 'الطول' : 'Length (Height)') },
    { key: 'shoulderWidth', label: (language === 'ar' ? 'عرض الكتف' : 'Shoulder Width') },
    { key: 'chest', label: (language === 'ar' ? 'الصدر' : 'Chest') },
    { key: 'waist', label: (language === 'ar' ? 'الخصر' : 'Waist') },
    { key: 'hips', label: (language === 'ar' ? 'الورك' : 'Hips') },
    { key: 'sleeveLength', label: (language === 'ar' ? 'طول الكم' : 'Sleeve Length') },
    { key: 'bicep', label: (language === 'ar' ? 'محيط العضد' : 'Bicep') },
    { key: 'forearm', label: (language === 'ar' ? 'محيط الساعد' : 'Forearm') },
    { key: 'neck', label: (language === 'ar' ? 'الرقبة' : 'Neck') },
    { key: 'wrist', label: (language === 'ar' ? 'المعصم' : 'Wrist/Cuff') },
    { key: 'cuffWidth', label: (language === 'ar' ? 'عرض الكفة' : 'Cuff Width') },
    { key: 'expansion', label: (language === 'ar' ? 'التوسيع' : 'Expansion (Gera/Bottom Flare)') },
    { key: 'armhole', label: (language === 'ar' ? 'فتحة الذراع' : 'Armhole') },
    { key: 'bottom', label: (language === 'ar' ? 'أسفل الثوب' : 'Bottom (Hem)') }
  ];

  const measurementFields = measurementsCatalog?.fields?.length
    ? measurementsCatalog.fields
        .filter((f) => f && f.enabled !== false)
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((f) => ({
          key: f.key,
          label: f.nameI18n?.[langKey] || t(`measurements.${f.key}`, { defaultValue: f.name || f.key }),
          image: f.image,
          imageUpdatedAt: f.imageUpdatedAt
        }))
    : fallbackMeasurementFields;

  const fallbackThawbTypes = THAWB_TYPES.map((t) => ({
    key: t.value,
    name: '',
    enabled: true,
    sortOrder: 0,
    image: null,
    imageUpdatedAt: null,
    fallbackImage: t.image,
    fallbackLabel: t.label,
    fallbackLabelAr: t.labelAr
  }));

  const thawbTypes = thawbTypesCatalog?.types?.length
    ? thawbTypesCatalog.types
        .filter((x) => x && x.enabled !== false)
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((x) => {
          const fallback = THAWB_TYPES.find((t) => t.value === x.key);
          return {
            key: x.key,
            name: x.name || '',
            nameI18n: x.nameI18n || {},
            image: x.image,
            imageUpdatedAt: x.imageUpdatedAt,
            fallbackImage: fallback?.image,
            fallbackLabel: fallback?.label,
            fallbackLabelAr: fallback?.labelAr
          };
        })
    : fallbackThawbTypes;

  const thawbTypeChoices = thawbTypes.map((thawb) => {
    const label = thawb.nameI18n?.[langKey] || t(`thawbTypes.${thawb.key}`, { defaultValue: thawb.name || thawb.fallbackLabel || thawb.key });
    return {
      key: thawb.key,
      label,
      subtitle: thawb.fallbackLabelAr || '',
      imageSrc: thawb.image ? `${resolveUploadsUrl(thawb.image)}${thawb.imageUpdatedAt ? `?v=${thawb.imageUpdatedAt}` : ''}` : thawb.fallbackImage
    };
  });

  const fallbackStyleGroups = [
    {
      key: 'collar', name: '', enabled: true, sortOrder: 0,
      options: [
        { key: 'classic',  name: '', image: '/thawbs/styles/collar_classic.webp' },
        { key: 'round',    name: '', image: '/thawbs/styles/collar_round.webp' },
        { key: 'mandarin', name: '', image: '/thawbs/styles/collar_mandarin.webp' },
        { key: 'open',     name: '', image: '/thawbs/styles/collar_open.webp' },
        { key: 'v_neck',   name: '', image: '/thawbs/styles/collar_v_neck.webp' },
        { key: 'chinese',  name: '', image: '/thawbs/styles/collar_chinese.webp' },
      ]
    },
    {
      key: 'bain', name: '', enabled: true, sortOrder: 1,
      options: [
        { key: 'hidden',  name: '', image: '/thawbs/styles/bain_hidden.webp' },
        { key: 'visible', name: '', image: '/thawbs/styles/bain_visible.webp' },
        { key: 'zip',     name: '', image: '/thawbs/styles/bain_zip.webp' },
        { key: 'half',    name: '', image: '/thawbs/styles/bain_half.webp' },
        { key: 'full',    name: '', image: '/thawbs/styles/bain_full.webp' },
      ]
    },
    {
      key: 'cuff', name: '', enabled: true, sortOrder: 2,
      options: [
        { key: 'single', name: '', image: '/thawbs/styles/cuff_single.webp' },
        { key: 'double', name: '', image: '/thawbs/styles/cuff_double.webp' },
        { key: 'round',  name: '', image: '/thawbs/styles/cuff_round.webp' },
        { key: 'angled', name: '', image: '/thawbs/styles/cuff_angled.webp' },
        { key: 'wide',   name: '', image: '/thawbs/styles/cuff_wide.webp' },
      ]
    },
    {
      key: 'pocket', name: '', enabled: true, sortOrder: 3,
      options: [
        { key: 'none',  name: '', image: '/thawbs/styles/pocket_none.webp' },
        { key: 'chest', name: '', image: '/thawbs/styles/pocket_chest.webp' },
        { key: 'side',  name: '', image: '/thawbs/styles/pocket_side.webp' },
        { key: 'both',  name: '', image: '/thawbs/styles/pocket_both.webp' },
      ]
    },
    {
      key: 'buttons', name: '', enabled: true, sortOrder: 4,
      options: [
        { key: 'classic', name: '', image: '/thawbs/styles/buttons_classic.webp' },
        { key: 'hidden',  name: '', image: '/thawbs/styles/buttons_hidden.webp' },
        { key: 'snap',    name: '', image: '/thawbs/styles/buttons_snap.webp' },
        { key: 'premium', name: '', image: '/thawbs/styles/buttons_premium.webp' },
        { key: 'golden',  name: '', image: '/thawbs/styles/buttons_golden.webp' },
      ]
    },
    {
      key: 'embroidery', name: '', enabled: true, sortOrder: 5,
      options: [
        { key: 'none',    name: '', image: '/thawbs/styles/embroidery_none.webp' },
        { key: 'name',    name: '', image: '/thawbs/styles/embroidery_name.webp' },
        { key: 'logo',    name: '' },
        { key: 'premium', name: '' },
        { key: 'arabic',  name: '' },
      ]
    },
  ];

  const styleGroups = ((styleCatalog?.groups?.length ? styleCatalog.groups : fallbackStyleGroups) || [])
    .filter((group) => group && group.enabled !== false)
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((group, groupIdx) => {
      const fallbackGroup = fallbackStyleGroups[groupIdx] || {};
      const groupKey = group.key || fallbackGroup.key;
      return {
        key: groupKey,
        label: group.nameI18n?.[langKey] || t(`styleOptions.${groupKey}`, { defaultValue: group.name || groupKey }),
        options: (group.options || [])
          .filter((option) => option && option.enabled !== false)
          .slice()
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((option, optionIdx) => {
            const fallbackOption = fallbackGroup.options?.[optionIdx] || {};
            const optionKey = option.key || fallbackOption.key;
            return {
              value: optionKey,
              label: option.nameI18n?.[langKey] || t(`styleOptions.options.${groupKey}.${optionKey}`, { defaultValue: option.name || optionKey }),
              imageSrc: option.image ? `${resolveUploadsUrl(option.image)}${option.imageUpdatedAt ? `?v=${option.imageUpdatedAt}` : ''}` : fallbackOption.image
            };
          })
          .filter((option) => option.value)
      };
    })
    .filter((group) => group.key);

  const workspaceStyleGroups = styleGroups;
  const advancedStyleGroups = [];

  const fallbackFabricColors = [
    { key: 'white', name: 'White', nameAr: 'أبيض', hex: '#FFFFFF' },
    { key: 'cream', name: 'Cream', nameAr: 'كريمي', hex: '#FFFDD0' },
    { key: 'offwhite', name: 'Off White', nameAr: 'أوف وايت', hex: '#FAF9F6' },
    { key: 'beige', name: 'Beige', nameAr: 'بيج', hex: '#F5F5DC' },
    { key: 'grey', name: 'Grey', nameAr: 'رمادي', hex: '#808080' },
    { key: 'black', name: 'Black', nameAr: 'أسود', hex: '#000000' },
    { key: 'navy', name: 'Navy', nameAr: 'كحلي', hex: '#000080' },
    { key: 'brown', name: 'Brown', nameAr: 'بني', hex: '#8B4513' }
  ];

  const fabricColors = fabricColorsCatalog?.colors?.length
    ? fabricColorsCatalog.colors
        .filter((c) => c && c.enabled !== false)
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((c) => {
          const fallback = fallbackFabricColors.find((x) => x.key === c.key);
          const fallbackName = langKey === 'ar' ? (fallback?.nameAr || fallback?.name) : fallback?.name;
          return {
            key: c.key,
            name: c.nameI18n?.[langKey] || c.name || fallbackName || c.key,
            nameAr: fallback?.nameAr || '',
            hex: c.hex || fallback?.hex || '#e5e7eb'
          };
        })
    : fallbackFabricColors;

  const batchMode = !isEdit && (orderItems?.length || 0) > 0;
  const batchQuantity = orderItems.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
  const batchItemsPrice = orderItems.reduce((sum, it) => sum + (Number(it?.price) || 0), 0);
  const totalPaidOverride = String(formData.paidAmount || '').trim() === '' ? null : (Number(formData.paidAmount) || 0);
  const batchTotalPrice = batchItemsPrice;
  const batchTotalPaid = totalPaidOverride === null ? 0 : totalPaidOverride;
  const measurementUi = user?.measurementUi || 'cards';
  const measurementVariantMap = {
    cards: 'sheet',
    atelier: 'board',
    monarch: 'sheet-minimal',
    noir: 'board-minimal'
  };
  const measurementVariant = measurementVariantMap[measurementUi] || 'sheet';
  const measurementLogoSrc = user?.logo ? resolveUploadsUrl(user.logo) : null;

  const renderMeasurementInputs = ({ title, subtitle, values, onChange, disabled = false, loading = false, badges = [], tone = 'slate', showDesignControls = false, measurementImageSrc = '', measurementImageName = '', onMeasurementImageChange: onMeasurementImageFileChange, onMeasurementImageRemove: onMeasurementImageDelete, showMeasurementImageControl = true, onExtractedData }) => (
    <div className="mt-4">
      <MeasurementAtelierPanel
        variant={measurementVariant}
        title={title}
        subtitle={subtitle}
        fields={measurementFields}
        values={values}
        onChange={onChange}
        disabled={disabled}
        loading={loading}
        thawbType={formData.thawbType}
        badges={badges}
        tone={tone}
        logoSrc={measurementLogoSrc}
        businessName={user?.businessName || ''}
        businessPhone={user?.phone || ''}
        styleGroups={workspaceStyleGroups}
        styleValues={formData.styleOptions || {}}
        onStyleChange={handleStyleOptionChange}
        showStyleControls={showDesignControls}
        thawbTypes={thawbTypeChoices}
        onThawbTypeChange={(value) => setFormData((prev) => ({ ...prev, thawbType: value }))}
        fabricOptions={Array.isArray(fabrics) ? fabrics : []}
        selectedFabricId={formData.fabricId || ''}
        onFabricChange={(value) => setFormData((prev) => ({ ...prev, fabricId: value, customFabricName: value ? '' : prev.customFabricName }))}
        customFabricName={formData.customFabricName || ''}
        onCustomFabricNameChange={(value) => setFormData((prev) => ({ ...prev, customFabricName: value, fabricId: String(value || '').trim() ? '' : prev.fabricId }))}
        rollsUsed={formData.rollsUsed}
        onRollsUsedChange={(value) => setFormData((prev) => ({ ...prev, rollsUsed: value }))}
        fabricColors={fabricColors}
        selectedFabricColor={formData.fabricColor || ''}
        onFabricColorChange={(value) => setFormData((prev) => ({ ...prev, fabricColor: value }))}
        materialsLoading={fabricsLoading || fabricColorsCatalogLoading}
        measurementImageSrc={measurementImageSrc}
        measurementImageName={measurementImageName}
        onMeasurementImageChange={onMeasurementImageFileChange}
        onMeasurementImageRemove={onMeasurementImageDelete}
        showMeasurementImageControl={showMeasurementImageControl}
        onExtractedData={onExtractedData}
      />
    </div>
  );

  // If order created, show print option
  if (createdOrder) {
    const orders = (createdOrders && createdOrders.length > 0) ? createdOrders : [createdOrder];
    return (
      <div className="max-w-md mx-auto space-y-6 animate-fadeIn">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Order Created!</h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            {orders.length > 1 ? `${orders.length} orders created` : `Receipt #${createdOrder.receiptNumber || createdOrder._id?.slice(-6)}`}
          </p>
          
          <div className="space-y-3">
            {orders.length === 1 ? (
              <Button onClick={() => handlePrintLabel(orders[0])} icon={Printer} className="w-full">
                {t('printLabel', { defaultValue: 'Print Label (80mm)' })}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button onClick={handlePrintFamilySummary} icon={Printer} className="w-full">
                  {t('printFamilyInvoice', { defaultValue: 'Print Family Invoice' })}
                </Button>
                {orders.map((o) => (
                  <Button
                    key={o._id}
                    variant="outline"
                    onClick={() => handlePrintLabel(o)}
                    icon={Printer}
                    className="w-full"
                  >
                    {t('printOrder', { defaultValue: 'Print' })} {o.orderFor || o.relationName || t('order', { defaultValue: 'Order' })} #{o.receiptNumber || o._id?.slice(-6)}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => navigate('/app/dashboard/khayyat/stitchings')} className="w-full">
              Back to Orders
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                revokeObjectUrl(formData.measurementImagePreview);
                orderItems.forEach((item) => revokeObjectUrl(item?.measurementImagePreview));
                setCreatedOrder(null);
                setCreatedOrders([]);
                setOrderItems([]);
                setSelectedCustomer(null);
                setQuickCustomerOpen(false);
                setQuickCustomer({ name: '', phone: '' });
                setSelectedRelation(null);
                setSelectedEmbroideryDesign(null);
                setCustomerSearch('');
                setFormData({ quantity: 1, price: '', paidAmount: '', description: '', dueDate: '', status: 'pending', thawbType: 'saudi', fabricColor: '', fabricId: '', customFabricName: '', rollsUsed: '', measurementImage: '', measurementImageUpdatedAt: null, measurementImageFile: null, measurementImagePreview: '', removeMeasurementImage: false, measurements: {}, styleOptions: {}, embroideryDesignId: null });
              }}
              className="w-full"
            >
              Create Another Order
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${measurementVariant === 'board' ? 'max-w-[1520px]' : 'max-w-[1380px]'} mx-auto space-y-6 animate-fadeIn`}>
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/dashboard/khayyat/stitchings')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800/50 dark:text-slate-300 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {isEdit ? (language === 'ar' ? 'تعديل الطلب' : 'Edit Order') : (language === 'ar' ? 'إنشاء طلب' : 'Create Order')}
        </h1>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Dropdown */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                {(language === 'ar' ? 'العميل' : 'Customer')} *
                </label>
                {!isEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCustomerOpen((prev) => !prev);
                      setDropdownOpen(false);
                      setSelectedCustomer(null);
                      setSelectedRelation(null);
                      selectedRelationIdRef.current = null;
                      setOrderItems([]);
                      setFamilyControlsOpen(false);
                      setExpandedOrderItemId(null);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      quickCustomerOpen
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {quickCustomerOpen ? 'Use Existing Customer' : 'Quick New Customer'}
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  data-tutorial="stitching-form-customer-select"
                  disabled={quickCustomerOpen}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {selectedCustomer ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                        <span className="text-primary-700 dark:text-primary-200 font-medium text-sm">{(selectedCustomer.nameI18n?.[langKey] || selectedCustomer.name || '')?.charAt(0)}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-slate-100">{selectedCustomer.nameI18n?.[langKey] || selectedCustomer.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{selectedCustomer.phone}</p>
                        {selectedCustomer.khayyatReceiptNumbers && (
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                            {language === 'ar' ? '\u0625\u064A\u0635\u0627\u0644\u0627\u062A' : 'Receipts'}: {selectedCustomer.khayyatReceiptNumbers}
                          </p>
                        )}
                        {selectedCustomer.khayyatHijriDate && (
                          <p className="text-[11px] text-gray-400 dark:text-slate-500">
                            {language === 'ar' ? '\u062A\u0627\u0631\u064A\u062E' : 'Date'}: {selectedCustomer.khayyatHijriDate}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-slate-400">Select customer...</span>
                  )}
                  <ChevronDown className={`w-5 h-5 text-gray-400 dark:text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 z-50">
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-100 dark:border-slate-700">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder={language === 'ar' ? '\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0631\u0642\u0645 \u0623\u0648 \u0627\u0644\u0625\u064A\u0635\u0627\u0644...' : 'Search by name, phone, or receipt...'}
                        data-tutorial="stitching-form-customer-search"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer._id}
                            type="button"
                            onClick={() => { handleCustomerSelect(customer); setCustomerSearch(''); }}
                            className={`w-full p-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3 text-left transition-colors border-b border-gray-100 dark:border-slate-700 last:border-b-0 ${
                              selectedCustomer?._id === customer._id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                              <span className="text-primary-700 dark:text-primary-200 font-medium">{(customer.nameI18n?.[langKey] || customer.name || '')?.charAt(0)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-slate-100">{customer.nameI18n?.[langKey] || customer.name}</p>
                              <p className="text-sm text-gray-500 dark:text-slate-400">{customer.phone}</p>
                              {customer.khayyatReceiptNumbers && (
                                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                                  {language === 'ar' ? '\u0625\u064A\u0635\u0627\u0644\u0627\u062A' : 'Receipts'}: {customer.khayyatReceiptNumbers}
                                </p>
                              )}
                              {customer.khayyatHijriDate && (
                                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                                  {language === 'ar' ? '\u062A\u0627\u0631\u064A\u062E' : 'Date'}: {customer.khayyatHijriDate}
                                </p>
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500 dark:text-slate-400">No customers found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {quickCustomerOpen ? (
                <div className="mt-3 rounded-2xl border border-primary-200 dark:border-primary-900/40 bg-primary-50/60 dark:bg-primary-900/10 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={quickCustomer.name}
                        onChange={(e) => setQuickCustomer((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Customer name"
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={quickCustomer.phone}
                        onChange={(e) => setQuickCustomer((prev) => ({ ...prev, phone: normalizeSaudiPhone(e.target.value) }))}
                        placeholder="+966..."
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                    A customer will be created automatically when you submit the order if this phone does not already exist.
                  </div>
                </div>
              ) : null}
            </div>

            {advancedStyleGroups.length > 0 ? (
             <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-gray-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 p-6">
              <button
                type="button"
                onClick={() => setStyleOptionsOpen((p) => !p)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Additional Style Options</h3>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 dark:text-slate-400 transition-transform ${styleOptionsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {styleOptionsOpen ? (
                <div className="space-y-5">
                  {styleCatalogLoading ? (
                    <div className="text-sm text-gray-500 dark:text-slate-400">Loading…</div>
                  ) : (
                    advancedStyleGroups.map((group) => {
                      const selectedValue = (formData.styleOptions || {})[group.key] || '';
                      return (
                        <div key={group.key}>
                          <Select
                            label={group.label}
                            value={selectedValue}
                            onChange={(e) => handleStyleOptionChange(group.key, e.target.value)}
                            options={[
                              { value: '', label: (language === 'ar' ? 'common.select' : 'common.select') },
                              ...(group.options || []).map((option) => ({ value: option.value, label: option.label }))
                            ]}
                            className="rounded-2xl bg-white/70 dark:bg-slate-900/40 border-gray-200 dark:border-slate-700"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
            ) : null}

            {/* Measurements - Premium Visual UI */}
            {!batchMode ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-gray-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 p-6">
                  <button
                    type="button"
                    onClick={() => setCustomerMeasurementsOpen((p) => !p)}
                    className="w-full flex items-center justify-between"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'المقاسات' : 'Measurements')} ({activeCustomerName || 'Customer'})</h3>
                    <ChevronDown className={`w-5 h-5 text-gray-400 dark:text-slate-400 transition-transform ${customerMeasurementsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {selectedCustomer?.measurements && Object.keys(selectedCustomer.measurements).length > 0 ? (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                        ✓ Auto-filled from customer
                      </span>
                    ) : null}
                    {selectedRelation ? (
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-full">
                        Read-only
                      </span>
                    ) : null}
                  </div>

                  {customerMeasurementsOpen ? (
                    renderMeasurementInputs({
                      title: `${(language === 'ar' ? 'المقاسات' : 'Measurements')} (${activeCustomerName || 'Customer'})`,
                      subtitle: selectedRelation ? 'Customer measurements are shown for reference while editing the selected order-for measurements.' : 'Capture a complete set of body measurements with a tailoring-focused workspace.',
                      values: selectedRelation ? (selectedCustomer?.measurements || {}) : (formData.measurements || {}),
                      onChange: (key, value) => {
                        if (selectedRelation) return;
                        handleMeasurementChange(key, value);
                      },
                      disabled: !!selectedRelation,
                      loading: measurementsCatalogLoading,
                      badges: [
                        selectedCustomer?.measurements && Object.keys(selectedCustomer.measurements).length > 0 ? 'Auto-filled from customer' : null,
                        selectedRelation ? 'Read-only reference' : null
                      ].filter(Boolean),
                      tone: 'slate',
                      showDesignControls: !selectedRelation,
                      measurementImageSrc: !selectedRelation ? (formData.measurementImagePreview || '') : '',
                      measurementImageName: !selectedRelation ? (formData.measurementImageFile?.name || '') : '',
                      onMeasurementImageChange: !selectedRelation ? handleMeasurementImageChange : undefined,
                      onMeasurementImageRemove: !selectedRelation ? handleMeasurementImageRemove : undefined,
                      showMeasurementImageControl: !selectedRelation,
                      onExtractedData: !selectedRelation ? (measurements, notes) => {
                        setFormData(prev => ({
                          ...prev,
                          measurements: { ...(prev.measurements || {}), ...measurements },
                          description: notes ? `${prev.description ? prev.description + '\n' : ''}${notes}` : prev.description
                        }));
                      } : undefined
                    })
                  ) : null}
                </div>

                {selectedRelation ? (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-900/20 dark:to-slate-900/50 p-6">
                    <button
                      type="button"
                      onClick={() => setOrderForMeasurementsOpen((p) => !p)}
                      className="w-full flex items-center justify-between"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'المقاسات' : 'Measurements')} ({selectedRelation?.name || ''})</h3>
                      <ChevronDown className={`w-5 h-5 text-amber-500 transition-transform ${orderForMeasurementsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <div className="mt-2 flex items-center gap-2">
                      {orderForDetailsLoading ? (
                        <span className="text-xs text-gray-500 dark:text-slate-400">Loading…</span>
                      ) : null}
                      {selectedRelation?.measurements && Object.keys(selectedRelation.measurements).length > 0 ? (
                        <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                          ✓ Auto-filled from {selectedRelation.name}
                        </span>
                      ) : null}
                    </div>

                    {orderForMeasurementsOpen ? (
                      renderMeasurementInputs({
                        title: `${(language === 'ar' ? 'المقاسات' : 'Measurements')} (${selectedRelation?.name || ''})`,
                        subtitle: 'Use the atelier layout to review fit balance, body proportions, and sleeve details in one place.',
                        values: formData.measurements || {},
                        onChange: (key, value) => handleMeasurementChange(key, value),
                        loading: measurementsCatalogLoading,
                        badges: [
                          selectedRelation?.measurements && Object.keys(selectedRelation.measurements).length > 0 ? `Auto-filled from ${selectedRelation.name}` : null
                        ].filter(Boolean),
                        tone: 'amber',
                        showDesignControls: true,
                        measurementImageSrc: formData.measurementImagePreview || '',
                        measurementImageName: formData.measurementImageFile?.name || '',
                        onMeasurementImageChange: handleMeasurementImageChange,
                        onMeasurementImageRemove: handleMeasurementImageRemove,
                        showMeasurementImageControl: true
                      })
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedEmbroideryDesign ? (
              <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'تصاميم التطريز' : 'Embroidery Designs')}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'معاينة' : 'Preview')}</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/app/dashboard/khayyat/embroidery-designs')}>
                    {(language === 'ar' ? 'تصاميم التطريز' : 'Embroidery Designs')}
                  </Button>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 p-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    {selectedEmbroideryDesign?.image ? (
                      <img
                        src={`${resolveUploadsUrl(selectedEmbroideryDesign.image)}${selectedEmbroideryDesign.imageUpdatedAt ? `?v=${selectedEmbroideryDesign.imageUpdatedAt}` : ''}`}
                        alt={selectedEmbroideryDesign?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300 dark:text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{selectedEmbroideryDesign?.name || '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{(language === 'ar' ? 'اسم التصميم' : 'Design Name')}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {!batchMode ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">{(language === 'ar' ? 'الكمية' : 'Quantity')}</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    min="1"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 flex items-center gap-1">{(language === 'ar' ? 'السعر' : 'Price')} <SARIcon className="w-4 h-4" /></label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="no-spinner w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 flex items-center gap-1">{(language === 'ar' ? 'المبلغ المدفوع' : 'Paid Amount')} <SARIcon className="w-4 h-4" /></label>
                  <input
                    type="number"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="no-spinner w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            ) : null}

            <Textarea
              label={(language === 'ar' ? 'الوصف' : 'Description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">{(language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date')}</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-400" />
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900/50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Family / شجرة العائلة</h3>
                    </div>
                    <div className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">Choose who this order is for.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFamilyControlsOpen((p) => !p)}
                      className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/20 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-white inline-flex items-center gap-2"
                    >
                      <span>{familyControlsOpen ? 'Hide' : 'Show'} Controls</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${familyControlsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openAddFamily('son')}
                      icon={UserPlus}
                      disabled={isDemo}
                    >
                      Add Member
                    </Button>
                  </div>
                </div>

                {familyControlsOpen ? (
                  <>
                    <div className="mt-5 rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-white/70 dark:bg-slate-900/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">Manage family</div>
                          <div className="mt-1 text-xs text-amber-900/70 dark:text-amber-100/70 truncate">Add members or review the family tree.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/user/customers/${selectedCustomer._id}`)}
                          className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/20 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-white"
                        >
                          View Family Tree
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-white/70 dark:bg-slate-900/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-amber-900/80 dark:text-amber-100/80">Add Order</div>
                        <div className="mt-1 text-[11px] text-amber-900/60 dark:text-amber-100/60">Tap “Add” then pick a person.</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAddOrderPickerOpen(true)}
                          disabled={isDemo}
                          className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-100/70 dark:bg-amber-900/25 text-xs font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-100 disabled:opacity-60"
                        >
                          <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" />Add</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {orderItems.map((it, idx) => {
                      const isExpanded = String(expandedOrderItemId || '') === String(it.id);
                      const priceNum = Number(it.price);
                      const priceText = Number.isFinite(priceNum) ? priceNum : (String(it.price || '').trim() === '' ? 0 : it.price);

                      return (
                        <div key={it.id} className="rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-white/80 dark:bg-slate-900/25 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setExpandedOrderItemId((curr) => (String(curr || '') === String(it.id) ? null : it.id))}
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-lg bg-amber-100/70 dark:bg-amber-900/25 text-[11px] font-bold text-amber-900 dark:text-amber-100">#{idx + 1}</span>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{it.orderFor || '-'}</div>
                                  <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{it.relationType || 'Self'}</div>
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-2">
                              <div className="hidden sm:flex items-center gap-2">
                                <div className="px-2.5 py-1 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/20 text-[11px] font-semibold text-amber-900 dark:text-amber-100">Qty: {it.quantity}</div>
                                <div className="px-2.5 py-1 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/20 text-[11px] font-semibold text-amber-900 dark:text-amber-100">Price: {priceText}</div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setExpandedOrderItemId((curr) => (String(curr || '') === String(it.id) ? null : it.id))}
                                className="p-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/20 text-amber-700 dark:text-amber-200 hover:bg-white"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>

                              <button
                                type="button"
                                onClick={() => removeOrderItem(it.id)}
                                className="p-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/20 text-rose-600 dark:text-rose-400 hover:bg-white"
                                aria-label="Remove"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="mt-3 space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-amber-900/80 dark:text-amber-100/80 mb-1">Qty</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={it.quantity}
                                    onChange={(e) => updateOrderItem(it.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/40 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-amber-900/80 dark:text-amber-100/80 mb-1">Price</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={it.price}
                                    onChange={(e) => updateOrderItem(it.id, { price: e.target.value })}
                                    placeholder="0"
                                    className="no-spinner w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/40 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                  />
                                </div>
                              </div>

                              {renderMeasurementInputs({
                                title: `${it.orderFor || 'Order'} Measurements`,
                                subtitle: 'Review each family member with the same workspace and keep the shared thawb, collar, and pocket styling aligned across the family order.',
                                values: it.measurements || {},
                                onChange: (key, value) => updateOrderItemMeasurement(it.id, key, value),
                                loading: measurementsCatalogLoading,
                                badges: [
                                  it.relationType || 'Self',
                                  `Qty ${it.quantity || 1}`
                                ].filter(Boolean),
                                tone: 'amber',
                                showDesignControls: true,
                                measurementImageSrc: it.measurementImagePreview || '',
                                measurementImageName: it.measurementImageFile?.name || '',
                                onMeasurementImageChange: (file) => updateOrderItemMeasurementImage(it.id, file),
                                onMeasurementImageRemove: () => removeOrderItemMeasurementImage(it.id),
                                showMeasurementImageControl: true
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                  })}

                  {orderItems.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/15 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-amber-900/70 dark:text-amber-100/70">Total Qty</div>
                          <div className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">{batchQuantity}</div>
                        </div>
                        <div>
                          <div className="text-xs text-amber-900/70 dark:text-amber-100/70">Total Price</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={batchTotalPrice}
                            onChange={(e) => redistributeBatchPrices(e.target.value)}
                            placeholder="0"
                            className="no-spinner mt-1 w-full px-3 py-2 bg-white/70 dark:bg-slate-900/20 border border-amber-200/70 dark:border-amber-800/40 rounded-xl text-sm font-semibold text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-amber-900/70 dark:text-amber-100/70">Total Paid</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.paidAmount}
                            onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                            placeholder="0"
                            className="no-spinner mt-1 w-full px-3 py-2 bg-white/70 dark:bg-slate-900/20 border border-amber-200/70 dark:border-amber-800/40 rounded-xl text-sm font-semibold text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-amber-900/70 dark:text-amber-100/70">Pending</div>
                          <div className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">{Number(batchTotalPrice || 0) - Number(batchTotalPaid || 0)}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-amber-900/70 dark:text-amber-100/70">
                        Total paid is distributed across members by price.
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant={isEdit ? 'primary' : 'success'} loading={loading} className="flex-1" disabled={isDemo}>
                {isEdit ? (language === 'ar' ? 'حفظ' : 'Save') : (language === 'ar' ? 'إنشاء طلب' : 'Create Order')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/app/dashboard/khayyat/stitchings')}>
                {(language === 'ar' ? 'إلغاء' : 'Cancel')}
              </Button>
            </div>

            <Modal
              isOpen={addFamilyOpen}
              onClose={() => setAddFamilyOpen(false)}
              title="Add Family Member"
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Relation type</div>
                    <select
                      value={addFamilyType}
                      onChange={(e) => setAddFamilyType(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#D5B25B]/40"
                    >
                      {RELATION_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>{rt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Search existing customer</div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={familyQuery}
                        onChange={(e) => {
                          setFamilyQuery(e.target.value);
                          setFamilySelected(null);
                        }}
                        placeholder="Search by name or phone"
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#D5B25B]/40"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 bg-white dark:bg-slate-900/40 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Results</div>
                    {familySearching ? <div className="text-xs text-slate-400">Searching…</div> : null}
                  </div>
                  <div className="max-h-56 overflow-y-auto bg-gray-50/40 dark:bg-slate-900/20">
                    {!familyQuery ? (
                      <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Type to search customers</div>
                    ) : null}
                    {(familyQuery && !familySearching && familyResults.length === 0) ? (
                      <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No matches</div>
                    ) : null}
                    {familyResults.map((c) => {
                      const display = c?.nameI18n?.[langKey] || c?.name || '—';
                      const active = String(familySelected?._id) === String(c?._id);
                      return (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setFamilySelected(c)}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-900/40 transition-colors ${active ? 'bg-white dark:bg-slate-900/50' : ''}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{display}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{c?.phone || ''}</div>
                          </div>
                          <div className={`w-9 h-9 rounded-full ring-2 ${active ? 'ring-[#D5B25B]/80' : 'ring-slate-300/70 dark:ring-slate-700/60'} bg-gradient-to-br from-white to-gray-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-sm font-semibold text-slate-900 dark:text-slate-100`}>
                            {String(display || '—').charAt(0)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 p-4">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Or create new customer</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={newFamilyName}
                      onChange={(e) => {
                        setNewFamilyName(e.target.value);
                        setFamilySelected(null);
                      }}
                      placeholder="Name"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#D5B25B]/40"
                    />
                    <input
                      value={newFamilyPhone}
                      onChange={(e) => {
                        setNewFamilyPhone(e.target.value);
                        setFamilySelected(null);
                      }}
                      placeholder="Phone"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#D5B25B]/40"
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">If you select an existing customer above, these fields are ignored.</div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setAddFamilyOpen(false)}>
                    {(language === 'ar' ? 'إلغاء' : 'Cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={saveFamilyMember}
                    loading={familySaving}
                    disabled={familySaving}
                    icon={UserPlus}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={addOrderPickerOpen}
              onClose={() => setAddOrderPickerOpen(false)}
              title="Add Order"
              size="md"
            >
              <div className="space-y-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">Choose who this order is for</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddOrderPickerOpen(false);
                      addOrderForTarget(null);
                    }}
                    className="w-full text-left rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 px-3 py-3 hover:bg-white dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-600 dark:text-slate-200" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedCustomer?.nameI18n?.[langKey] || selectedCustomer?.name || 'Self'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Self</div>
                      </div>
                    </div>
                  </button>

                  {(selectedCustomer?.relations || []).map((r, idx) => {
                    const relUi = normalizeRelationForUi(r);
                    const display = relUi?.name || '-';
                    return (
                      <button
                        key={`${relUi?._id || idx}`}
                        type="button"
                        onClick={() => {
                          setAddOrderPickerOpen(false);
                          addOrderForTarget(relUi);
                        }}
                        className="w-full text-left rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30 px-3 py-3 hover:bg-white dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <span className="text-amber-700 dark:text-amber-200 font-semibold">{String(display).charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{display}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{relUi?.type || ''}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Modal>

            <DemoBlockedModal
              isOpen={demoBlockedOpen}
              onClose={() => setDemoBlockedOpen(false)}
              title={(language === 'ar' ? 'وضع العرض' : 'Demo Mode')}
              phone="+966596775485"
            />
          </form>
        </CardBody>
      </Card>

      {/* Print Modal for ThermalReceipt */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[400px] mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">{(language === 'ar' ? 'إيصال الطلب' : 'Order Receipt')}</h3>
              <button onClick={() => setPrintOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt ref={printRef} order={printOrder} type="khayyat" />
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={() => setPrintOrder(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 flex-1">
                {(language === 'ar' ? 'إغلاق' : 'Close')}
              </button>
              <button onClick={() => {
                if (printRef.current) {
                  printThermalElement(printRef.current, getThermalPrinterSettings(tenant));
                }
              }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white flex-1">
                {(language === 'ar' ? 'طباعة' : 'Print Receipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StitchingForm;
