import express from 'express';
import KhayyatEmbroideryDesign from '../../models/khayyat/KhayyatEmbroideryDesign.js';
import { protect, tenantFilter, requireTenantFilter } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

router.get('/', async (req, res) => {
  try {
    const designs = await KhayyatEmbroideryDesign.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 });
    res.json({ designs });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const design = await KhayyatEmbroideryDesign.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json({ design });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, note } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const design = new KhayyatEmbroideryDesign({
      tenantId: req.user.tenantId,
      name,
      note: note || ''
    });

    await design.save();
    res.status(201).json({ message: 'Design created', design });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const design = await KhayyatEmbroideryDesign.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!design) return res.status(404).json({ error: 'Design not found' });

    if (req.body.name) design.name = req.body.name;
    if (req.body.note !== undefined) design.note = req.body.note;

    await design.save();
    res.json({ message: 'Design updated', design });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const design = await KhayyatEmbroideryDesign.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json({ message: 'Design deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
