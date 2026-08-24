import PickingList from './PickingList'
import { INVENTORY_PATH } from './inventoryUi'

export default function ReceiptsList() {
  return <PickingList code="incoming" newPath={`${INVENTORY_PATH.receiptNew}?code=incoming`} />
}
