import PickingList from './PickingList'
import { INVENTORY_PATH } from './inventoryUi'

export default function DeliveriesList() {
  return <PickingList code="outgoing" newPath={`${INVENTORY_PATH.deliveryNew}?code=outgoing`} />
}
