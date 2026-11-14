import {productById} from './data.mjs';
export const SIZES=['S','M','L','XL'];
export const STORAGE_KEY='cosmic-laundry-demo-bag-v1';
export const quantity=value=>Number.isFinite(Number(value))?Math.max(1,Math.min(99,Math.floor(Number(value)))):1;
export function addItem(bag,id,size,qty){
 if(!productById(id)||!SIZES.includes(size))return bag;
 const existing=bag.find(item=>item.id===id&&item.size===size);
 return existing?bag.map(item=>item===existing?{...item,quantity:quantity(item.quantity+quantity(qty))}:item):[...bag,{id,size,quantity:quantity(qty)}];
}
export function normalizeBag(input){
 if(!Array.isArray(input))return [];
 return input.reduce((bag,item)=>item&&typeof item==='object'?addItem(bag,item.id,item.size,item.quantity):bag,[]);
}
export const countBag=bag=>bag.reduce((n,item)=>n+item.quantity,0);
export const setQuantity=(bag,index,qty)=>bag.map((item,i)=>i===index?{...item,quantity:quantity(qty)}:item);
