import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Minus, Plus, ShoppingBag } from 'lucide-react';

type MenuProduct = { id:string; name:string; price:string|number; image_url?:string|null; description?:string|null; category?:string|null };
type MenuData = { branch:{id:string;name:string;organizationName:string}; products:MenuProduct[]; categories:string[] };
type OrderType = 'Dine-in'|'Pickup'|'Home Delivery';

const API_BASE=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const money=(value:number)=>'SAR '+value.toFixed(2);

export default function CustomerMenu(){
  const params=new URLSearchParams(window.location.search);
  const branchId=params.get('branch')||'';
  const tableNumber=params.get('table')||'';
  const [menu,setMenu]=useState<MenuData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [category,setCategory]=useState('All');
  const [cart,setCart]=useState<Record<string,number>>({});
  const [customerName,setCustomerName]=useState('');
  const [phone,setPhone]=useState('');
  const [address,setAddress]=useState('');
  const [notes,setNotes]=useState('');
  const [orderType,setOrderType]=useState<OrderType>(tableNumber?'Dine-in':'Pickup');
  const [submitting,setSubmitting]=useState(false);
  const [success,setSuccess]=useState<{number:string|number;total:number}|null>(null);

  useEffect(()=>{
    if(!branchId){setError('This QR menu link is missing its restaurant branch. Scan the QR code again.');setLoading(false);return;}
    let active=true;
    fetch(API_BASE+'/api/menu?branchId='+encodeURIComponent(branchId))
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Menu could not be loaded.');return data as MenuData;})
      .then(data=>{if(active)setMenu(data);})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Menu could not be loaded.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[branchId]);

  const visibleProducts=useMemo(()=>!menu?[]:menu.products.filter(product=>(category==='All'||product.category===category)),[menu,category]);
  const cartItems=useMemo(()=>Object.entries(cart).map(([id,quantity])=>({product:menu?.products.find(item=>item.id===id),quantity})).filter((item):item is {product:MenuProduct;quantity:number}=>Boolean(item.product)&&item.quantity>0),[cart,menu]);
  const subtotal=cartItems.reduce((sum,item)=>sum+Number(item.product.price)*item.quantity,0);
  const tax=Number((subtotal*.15).toFixed(2));
  const total=Number((subtotal+tax).toFixed(2));
  const itemCount=cartItems.reduce((sum,item)=>sum+item.quantity,0);

  const submitOrder=async()=>{
    if(!menu||!cartItems.length||submitting)return;
    if(customerName.trim().length<2||phone.trim().length<5){setError('Enter your name and a valid phone number.');return;}
    if(orderType==='Dine-in'&&!tableNumber){setError('A table number is required for dine-in orders.');return;}
    if(orderType==='Home Delivery'&&!address.trim()){setError('Enter your delivery address.');return;}
    setSubmitting(true);setError('');
    try{
      const idempotencyKey=crypto.randomUUID();
      const response=await fetch(API_BASE+'/api/qr/orders',{
        method:'POST',
        headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
        body:JSON.stringify({
          branchId,
          customerName:customerName.trim(),
          phone:phone.trim(),
          address:address.trim(),
          orderType,
          ...(orderType==='Dine-in'?{tableNumber}:{}),
          notes:notes.trim(),
          items:cartItems.map(item=>({productId:item.product.id,quantity:item.quantity}))
        })
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Your order could not be submitted.');
      setSuccess({number:result.order.order_number,total:Number(result.order.total)});
      setCart({});
    }catch(reason){setError(reason instanceof Error?reason.message:'Your order could not be submitted.');}
    finally{setSubmitting(false);}
  };

  return <main className="min-h-screen bg-[#f5f2e9] text-[#18382f]">
    <header className="sticky top-0 z-20 border-b border-[#e6dfcf] bg-[#f8f6ef]/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#a17b22]">Musafir Fast Food</p><h1 className="mt-1 text-xl font-bold">{menu?.branch.name||'Restaurant menu'}</h1><p className="mt-1 text-xs text-[#78837d]">{tableNumber?'Table '+tableNumber+' · Scan, order and enjoy':'Freshly prepared · Order directly from the menu'}</p></div>
        <div className="rounded-xl bg-[#145044] px-3 py-2 text-xs font-semibold text-white"><ShoppingBag size={14} className="mr-1 inline"/> {itemCount} items</div>
      </div>
    </header>
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section>
        {loading?<div className="rounded-2xl bg-white p-8 text-center text-sm text-[#78837d]">Loading menu…</div>:error&&!menu?<div className="rounded-2xl bg-white p-8 text-center text-sm text-rose-700">{error}</div>:<>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2"><button onClick={()=>setCategory('All')} className={'shrink-0 rounded-full px-4 py-2 text-xs font-semibold '+(category==='All'?'bg-[#145044] text-white':'border border-[#d9d2c1] bg-white')}>All items</button>{menu?.categories.map(name=><button key={name} onClick={()=>setCategory(name)} className={'shrink-0 rounded-full px-4 py-2 text-xs font-semibold '+(category===name?'bg-[#145044] text-white':'border border-[#d9d2c1] bg-white')}>{name}</button>)}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visibleProducts.map(product=><article key={product.id} className="overflow-hidden rounded-2xl border border-[#e4dece] bg-white shadow-sm">
            <div className="aspect-[4/3] bg-[#eee9dd]">{product.image_url?<img src={product.image_url} alt={product.name} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-xs text-[#9b9b8e]">Musafir kitchen</div>}</div>
            <div className="p-3"><h2 className="min-h-9 text-sm font-bold">{product.name}</h2>{product.description&&<p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-[#78837d]">{product.description}</p>}<div className="mt-3 flex items-center justify-between gap-2"><strong className="text-xs text-[#145044]">{money(Number(product.price))}</strong><button onClick={()=>setCart(current=>({...current,[product.id]:(current[product.id]||0)+1}))} className="grid h-8 w-8 place-items-center rounded-lg bg-[#145044] text-white"><Plus size={16}/></button></div></div>
          </article>)}</div>
          {!visibleProducts.length&&<p className="rounded-2xl bg-white p-8 text-center text-sm text-[#78837d]">No items in this category.</p>}
        </>}
      </section>
      <aside className="h-fit rounded-2xl border border-[#e4dece] bg-white p-4 shadow-sm lg:sticky lg:top-28">
        {success?<div className="py-6 text-center"><CheckCircle2 size={42} className="mx-auto text-[#176044]"/><h2 className="mt-4 text-xl font-bold">Order received</h2><p className="mt-2 text-sm text-[#78837d]">Order #{success.number}</p><p className="mt-3 text-lg font-bold text-[#145044]">{money(success.total)}</p><p className="mt-3 text-xs leading-5 text-[#78837d]">Your order is awaiting restaurant confirmation. {orderType==='Home Delivery'?'Pay Cash or Mada when your order is delivered.':'Pay Cash or Mada at the restaurant when your order is served or collected.'}</p><button onClick={()=>{setSuccess(null);setCustomerName('');setPhone('');setAddress('');setNotes('');}} className="mt-5 rounded-xl bg-[#145044] px-4 py-2.5 text-xs font-semibold text-white">Back to menu</button></div>:<>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Your order</h2><span className="text-xs text-[#78837d]">{itemCount} items</span></div>
          <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">{cartItems.map(item=><div key={item.product.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.product.name}</p><p className="text-[10px] text-[#78837d]">{money(Number(item.product.price))} each</p></div><button onClick={()=>setCart(current=>({...current,[item.product.id]:Math.max(0,(current[item.product.id]||0)-1)}))} className="grid h-7 w-7 place-items-center rounded-md border border-[#e4dece]"><Minus size={12}/></button><span className="w-4 text-center text-xs">{item.quantity}</span><button onClick={()=>setCart(current=>({...current,[item.product.id]:(current[item.product.id]||0)+1}))} className="grid h-7 w-7 place-items-center rounded-md border border-[#e4dece]"><Plus size={12}/></button></div>)}</div>
          <div className="mt-4 space-y-2 border-t border-[#eee8da] pt-3 text-xs"><div className="flex justify-between"><span className="text-[#78837d]">Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span className="text-[#78837d]">VAT (15%)</span><span>{money(tax)}</span></div><div className="flex justify-between text-sm font-bold"><span>Total</span><span className="text-[#145044]">{money(total)}</span></div></div>
          <div className="mt-4 space-y-3 border-t border-[#eee8da] pt-4">
            <label className="block text-[11px] font-semibold">Order type<select value={orderType} onChange={event=>setOrderType(event.target.value as OrderType)} className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs">{tableNumber&&<option value="Dine-in">Dine-in · Table {tableNumber}</option>}<option value="Pickup">Pickup</option><option value="Home Delivery">Home Delivery</option></select></label>
            <label className="block text-[11px] font-semibold">Your name<input value={customerName} onChange={event=>setCustomerName(event.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs" placeholder="Full name"/></label>
            <label className="block text-[11px] font-semibold">Phone number<input value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs" placeholder="+966…"/></label>
            {orderType==='Home Delivery'&&<label className="block text-[11px] font-semibold">Delivery address<textarea value={address} onChange={event=>setAddress(event.target.value)} autoComplete="street-address" rows={2} className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs" placeholder="Building, street, district"/></label>}
            <label className="block text-[11px] font-semibold">Order note (optional)<textarea value={notes} onChange={event=>setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs" placeholder="No onions, extra sauce…"/></label>
          </div>
          {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
          <button onClick={()=>void submitOrder()} disabled={!cartItems.length||submitting||loading} className="mt-4 w-full rounded-xl bg-[#145044] py-3 text-sm font-bold text-white disabled:opacity-40">{submitting?'Submitting…':'Place order · '+money(total)}</button>
          <p className="mt-2 text-center text-[10px] leading-4 text-[#78837d]">No online payment is taken. The restaurant confirms your order and collects Cash or Mada {orderType==='Home Delivery'?'on delivery.':'at the counter.'}</p>
        </>}
      </aside>
    </div>
    <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-[10px] text-[#8b9086]">Powered by Musafir Fast Food</footer>
  </main>;
}
