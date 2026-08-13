import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import logger from './logger.js';

export function atlasSearchIndexName() {
  const raw = String(process.env.ATLAS_SEARCH_INDEX || '').trim();
  if (raw === 'false' || raw === '0') return '';
  if (raw) return raw;
  if (/mongodb\.net/i.test(process.env.MONGODB_URI || '')) return 'invoices_search';
  return '';
}

export function atlasSearchEnabled() {
  return Boolean(atlasSearchIndexName());
}

const SEARCH_INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      tenantId: { type: 'objectId' },
      searchText: {
        type: 'string',
        analyzer: 'lucene.standard',
      },
      invoiceNumber: {
        type: 'string',
        analyzer: 'lucene.keyword',
      },
      'buyer.name': { type: 'string', analyzer: 'lucene.standard' },
      'buyer.nameAr': { type: 'string', analyzer: 'lucene.standard' },
      issueDate: { type: 'date' },
    },
  },
};

export async function ensureAtlasSearchIndex() {
  const name = atlasSearchIndexName();
  if (!name) return false;
  try {
    const existing = await Invoice.collection.listSearchIndexes().toArray();
    if (existing?.some((idx) => idx.name === name)) return true;
    await Invoice.collection.createSearchIndex({
      name,
      definition: SEARCH_INDEX_DEFINITION,
    });
    logger.info(`[invoiceSearch] created Atlas Search index ${name}`);
    return true;
  } catch (error) {
    logger.warn(`[invoiceSearch] Atlas index skipped: ${error.message}`);
    return false;
  }
}

function applyRegexSearch(query, searchTerm) {
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = { $regex: escaped, $options: 'i' };
  query.$and = (query.$and || []).concat([{
    $or: [
      { searchText: re },
      { invoiceNumber: re },
      { 'buyer.name': re },
      { 'buyer.nameAr': re },
    ],
  }]);
  return query;
}

/**
 * Tenant-scoped invoice search. Uses Atlas $search when the index exists,
 * otherwise regex on denormalized searchText.
 */
export async function applyInvoiceListSearch(query, searchTerm, tenantId) {
  const term = String(searchTerm || '').trim();
  if (!term) return query;

  const index = atlasSearchIndexName();
  if (index && tenantId) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));
      const should = [
        { wildcard: { query: `*${term}*`, path: 'invoiceNumber', allowAnalyzedField: true } },
        { wildcard: { query: `*${term}*`, path: 'searchText', allowAnalyzedField: true } },
      ];
      if (term.length >= 3) {
        should.unshift({
          text: {
            query: term,
            path: ['searchText', 'buyer.name', 'buyer.nameAr'],
            fuzzy: { maxEdits: 1 },
          },
        });
      }
      const rows = await Invoice.aggregate([
        {
          $search: {
            index,
            compound: {
              filter: [{ equals: { path: 'tenantId', value: tenantObjectId } }],
              should,
              minimumShouldMatch: 1,
            },
          },
        },
        { $project: { _id: 1 } },
        { $limit: 200 },
      ]);
      query._id = { $in: rows.map((row) => row._id) };
      return query;
    } catch (error) {
      logger.warn(`[invoiceSearch] $search failed, regex fallback: ${error.message}`);
    }
  }

  return applyRegexSearch(query, term);
}

export default { atlasSearchEnabled, applyInvoiceListSearch, ensureAtlasSearchIndex };
