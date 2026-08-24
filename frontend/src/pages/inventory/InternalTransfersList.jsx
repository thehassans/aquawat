import PickingList from './PickingList'
import { INVENTORY_PATH } from './inventoryUi'

export default function InternalTransfersList() {
  return <PickingList code="internal" newPath={`${INVENTORY_PATH.internalNew}?code=internal`} />
}
