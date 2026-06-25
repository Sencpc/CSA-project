import { useDispatch, useSelector } from "react-redux";
import {
  addItem as addItemAction,
  addItems as addItemsAction,
  applyCoupon as applyCouponAction,
  clearCart as clearCartAction,
  clearCoupon as clearCouponAction,
  removeItem as removeItemAction,
  selectCartCoupon,
  selectCartItems,
  selectCartTotals,
} from "../store/cartSlice";

export const useCart = () => {
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);
  const totals = useSelector(selectCartTotals);
  const coupon = useSelector(selectCartCoupon);

  return {
    items,
    coupon,
    totalPrice: totals.totalPrice,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    totalDuration: totals.totalDuration,
    payable: totals.payable,
    addItem: (service) => dispatch(addItemAction(service)),
    addItems: (services) => dispatch(addItemsAction(services)),
    removeItem: (entryId) => dispatch(removeItemAction(entryId)),
    clearCart: () => dispatch(clearCartAction()),
    applyCoupon: (payload) => dispatch(applyCouponAction(payload)),
    clearCoupon: () => dispatch(clearCouponAction()),
  };
};
