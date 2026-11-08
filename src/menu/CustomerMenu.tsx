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
  const [checkoutKey,setCheckoutKey]=useState('');
  const [checkoutFingerprint,setCheckoutFingerprint]=useState('');
  const [success,setSuccess]=useState<{number:string|number;total:number;items:{name:string;price:number;quantity:number}[]}|null>(null);

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
      const payload={
        branchId,
        customerName:customerName.trim(),
        phone:phone.trim(),
        address:address.trim(),
        orderType,
        ...(orderType==='Dine-in'?{tableNumber}:{}),
        notes:notes.trim(),
        items:cartItems.map(item=>({productId:item.product.id,quantity:item.quantity}))
      };
      const fingerprint=JSON.stringify(payload);
      const idempotencyKey=checkoutFingerprint===fingerprint&&checkoutKey?checkoutKey:crypto.randomUUID();
      setCheckoutFingerprint(fingerprint);
      setCheckoutKey(idempotencyKey);
      const response=await fetch(API_BASE+'/api/qr/orders',{
        method:'POST',
        headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
        body:JSON.stringify(payload)
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Your order could not be submitted.');
      setSuccess({number:result.order.order_number,total:Number(result.order.total),items:cartItems.map(item=>({name:item.product.name,price:Number(item.product.price),quantity:item.quantity}))});
      setCart({});
      setCheckoutKey('');
      setCheckoutFingerprint('');
    }catch(reason){setError(reason instanceof Error?reason.message:'Your order could not be submitted.');}
    finally{setSubmitting(false);}
  };

  return <main className="min-h-screen bg-[#f4f0e7] text-[#18382f] selection:bg-[#d8b66b]/40">
    <header className="sticky top-0 z-20 border-b border-[#e6dfcf] bg-[#f8f6ef]/95 px-4 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#c6a66b]/60 bg-[#102b25] font-serif text-2xl italic text-[#e8ca87]">M</div>
          <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.28em] text-[#a17b22]">Musafir Fast Food</p><h1 className="truncate text-lg font-semibold tracking-tight text-[#18382f]">{menu?.branch.name||'Restaurant menu'}</h1><p className="mt-0.5 text-[10px] text-[#78837d]">{tableNumber?'Table '+tableNumber+' · Scan, order and enjoy':'Freshly prepared · Order directly from the menu'}</p></div>
        </div>
        {!success&&<div className="rounded-xl bg-[#102b25] px-3 py-2 text-xs font-semibold text-[#f2d99e]"><ShoppingBag size={14} className="mr-1 inline"/> {itemCount} items</div>}
      </div>
    </header>

    {success ? <section className="qr-order-confirmation mx-auto flex min-h-[calc(100vh-82px)] max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full overflow-hidden rounded-[2rem] border border-[#e2d8c5] bg-[#fffdf8] shadow-[0_24px_70px_rgba(31,48,39,.12)]">
        <div className="relative overflow-hidden bg-[#102b25] px-6 py-10 text-center text-[#f7f1e5] sm:px-12 sm:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full border border-[#d8b66b]/20"/>
          <div aria-hidden="true" className="pointer-events-none absolute -left-20 -bottom-36 h-72 w-72 rounded-full border border-[#d8b66b]/15"/>
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#d8b66b]/50 bg-[#d8b66b]/10"><CheckCircle2 size={34} className="text-[#e8ca87]"/></div>
          <p className="relative mt-6 text-[10px] font-bold uppercase tracking-[.3em] text-[#d8b66b]">Thank you · Musafir</p>
          <h2 className="relative mt-3 font-serif text-4xl font-medium tracking-tight sm:text-5xl">Order completed.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[#d4d0c4]">Your order has been received successfully. We have saved the order with the restaurant.</p>
          <div className="relative mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-[#d8b66b]/35 bg-white/5 px-5 py-2.5">
            <span className="text-[9px] uppercase tracking-[.2em] text-[#c7b99a]">Order number</span><strong className="font-serif text-xl text-[#f2d99e]">#{success.number}</strong>
          </div>
        </div>
        <div className="px-6 py-7 sm:px-12 sm:py-9">
          <div className="flex items-end justify-between border-b border-[#e8e1d4] pb-4"><div><p className="text-[9px] font-bold uppercase tracking-[.22em] text-[#a17b22]">Order summary</p><p className="mt-1 text-sm font-semibold text-[#18382f]">{menu?.branch.name||'Musafir Fast Food'}</p><p className="mt-1 text-[11px] text-[#78837d]">{orderType}{orderType==='Dine-in'&&tableNumber?' · Table '+tableNumber:''}</p></div><strong className="font-serif text-2xl text-[#145044]">{money(success.total)}</strong></div>
          <div className="mt-5 space-y-3 border-b border-[#e8e1d4] pb-5">{success.items.map((item,index)=><div key={index} className="flex items-center justify-between gap-4 text-xs"><span className="min-w-0 text-[#52645b]">{item.quantity} × {item.name}</span><strong className="shrink-0 text-[#203b32]">{money(item.price*item.quantity)}</strong></div>)}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#78837d]"><span>Payment: Cash or Mada</span><span>VAT included · 15%</span></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={()=>window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#c6a66b] bg-[#fffdf8] px-5 py-3.5 text-xs font-bold uppercase tracking-[.12em] text-[#18382f] transition hover:bg-[#f4f0e7]"><span aria-hidden="true">▤</span> Print receipt</button>
            <button type="button" onClick={()=>{setSuccess(null);setCustomerName('');setPhone('');setAddress('');setNotes('');setError('');}} className="rounded-xl bg-[#145044] px-5 py-3.5 text-xs font-bold uppercase tracking-[.12em] text-white transition hover:bg-[#0e3d34]">Back to menu</button>
          </div>
          <p className="mt-5 text-center text-[10px] leading-5 text-[#8a9087]">No need to print. Your order is already saved in the restaurant order history.</p>
        </div>
      </div>
    </section> : <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section className="min-w-0">
        <div className="relative mb-6 overflow-hidden rounded-[1.7rem] bg-[#102b25] px-6 py-8 text-[#f7f1e5] shadow-[0_18px_45px_rgba(16,43,37,.12)] sm:px-9 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-[#d8b66b]/20"/>
          <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-16 h-48 w-48 rounded-full border border-[#d8b66b]/15"/>
          <p className="relative text-[9px] font-bold uppercase tracking-[.3em] text-[#d8b66b]">Made for good moments</p>
          <h2 className="relative mt-3 max-w-xl font-serif text-4xl font-medium leading-[1.04] tracking-tight sm:text-5xl">Good food.<br/><span className="italic text-[#e2c27e]">Your way.</span></h2>
          <p className="relative mt-4 max-w-md text-xs leading-6 text-[#c6c0b3]">Explore the menu, choose your favourites, and place your order in a few simple steps.</p>
          <p className="relative mt-5 text-[9px] uppercase tracking-[.2em] text-[#b9ad91]">{menu?.branch.name||'Musafir'}{tableNumber?' · Table '+tableNumber:''}</p>
        </div>
        {loading?<div className="rounded-2xl bg-white p-8 text-center text-sm text-[#78837d]">Loading menu…</div>:error&&!menu?<div className="rounded-2xl bg-white p-8 text-center text-sm text-rose-700">{error}</div>:<>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{['All',...(menu?.categories||[])].map(name=><button key={name} type="button" onClick={()=>setCategory(name)} aria-pressed={category===name} className={'shrink-0 rounded-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.13em] transition '+(category===name?'bg-[#102b25] text-[#f2d99e] shadow-sm':'border border-[#ded6c6] bg-[#fffdf8] text-[#68766e] hover:border-[#c6a66b]')}>{name==='All'?'Everything':name}</button>)}</div>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.24em] text-[#a17b22]">The selection</p><h2 className="mt-1 font-serif text-2xl text-[#18382f]">{category==='All'?'Explore our menu':category}</h2></div><span className="text-[10px] text-[#8a9087]">{visibleProducts.length} items</span></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">{visibleProducts.map(product=><article key={product.id} className="group overflow-hidden rounded-[1.25rem] border border-[#e5dece] bg-[#fffdf8] shadow-[0_8px_25px_rgba(31,48,39,.045)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(31,48,39,.1)]">
            <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e5d9]">{product.image_url?<img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"/>:<div className="grid h-full place-items-center bg-[#e9e5d9] font-serif text-4xl italic text-[#a8a18f]">M</div>}<span className="absolute bottom-2 left-2 rounded-full border border-white/30 bg-black/50 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">{product.category||'Menu'}</span></div>
            <div className="p-3 sm:p-4"><h3 className="min-h-9 text-xs font-bold leading-5 text-[#203b32] sm:text-sm">{product.name}</h3>{product.description&&<p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-[#78837d]">{product.description}</p>}<div className="mt-3 flex items-center justify-between gap-2"><strong className="text-xs font-bold text-[#145044]">{money(Number(product.price))}</strong><button type="button" aria-label={'Add '+product.name} onClick={()=>setCart(current=>({...current,[product.id]:(current[product.id]||0)+1}))} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#145044] text-white transition hover:bg-[#0e3d34]"><Plus size={16}/></button></div></div>
          </article>)}</div>
          {!visibleProducts.length&&<p className="rounded-2xl bg-white p-8 text-center text-sm text-[#78837d]">No items in this category.</p>}
        </>}
      </section>
      <aside className="h-fit min-w-0 rounded-[1.5rem] border border-[#e4dece] bg-[#fffdf8] p-4 shadow-[0_12px_35px_rgba(31,48,39,.07)] lg:sticky lg:top-24">
        <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#a17b22]">Your selection</p><h2 className="mt-1 font-serif text-xl text-[#18382f]">Your order</h2></div><span className="rounded-full bg-[#f0ede4] px-3 py-1.5 text-[10px] font-semibold text-[#68766e]">{itemCount} items</span></div>
        <div className="mt-4 max-h-56 space-y-3 overflow-y-auto">{cartItems.map(item=><div key={item.product.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#203b32]">{item.product.name}</p><p className="text-[10px] text-[#78837d]">{money(Number(item.product.price))} each</p></div><button type="button" aria-label={'Remove one '+item.product.name} onClick={()=>setCart(current=>({...current,[item.product.id]:Math.max(0,(current[item.product.id]||0)-1)}))} className="grid h-7 w-7 place-items-center rounded-lg border border-[#e4dece] text-[#145044]"><Minus size={12}/></button><span className="w-4 text-center text-xs">{item.quantity}</span><button type="button" aria-label={'Add one '+item.product.name} onClick={()=>setCart(current=>({...current,[item.product.id]:(current[item.product.id]||0)+1}))} className="grid h-7 w-7 place-items-center rounded-lg border border-[#e4dece] text-[#145044]"><Plus size={12}/></button></div>)}</div>
        <div className="mt-4 space-y-2 border-t border-[#eee8da] pt-3 text-xs"><div className="flex justify-between"><span className="text-[#78837d]">Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span className="text-[#78837d]">VAT (15%)</span><span>{money(tax)}</span></div><div className="flex justify-between text-sm font-bold"><span>Total</span><span className="text-[#145044]">{money(total)}</span></div></div>
        <div className="mt-4 space-y-3 border-t border-[#eee8da] pt-4">
          <label className="block text-[11px] font-semibold text-[#314b41]">Order type<select value={orderType} onChange={event=>setOrderType(event.target.value as OrderType)} className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs text-[#18382f]">{tableNumber&&<option value="Dine-in">Dine-in · Table {tableNumber}</option>}<option value="Pickup">Pickup</option><option value="Home Delivery">Home Delivery</option></select></label>
          <label className="block text-[11px] font-semibold text-[#314b41]">Your name<input value={customerName} onChange={event=>setCustomerName(event.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs text-[#18382f]" placeholder="Full name"/></label>
          <label className="block text-[11px] font-semibold text-[#314b41]">Phone number<input value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs text-[#18382f]" placeholder="+966…"/></label>
          {orderType==='Home Delivery'&&<label className="block text-[11px] font-semibold text-[#314b41]">Delivery address<textarea value={address} onChange={event=>setAddress(event.target.value)} autoComplete="street-address" rows={2} className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs text-[#18382f]" placeholder="Building, street, district"/></label>}
          <label className="block text-[11px] font-semibold text-[#314b41]">Order note (optional)<textarea value={notes} onChange={event=>setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[#ded8c9] bg-[#faf9f5] px-3 py-2.5 text-xs text-[#18382f]" placeholder="No onions, extra sauce…"/></label>
        </div>
        {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        <button type="button" onClick={()=>void submitOrder()} disabled={!cartItems.length||submitting||loading} className="mt-4 w-full rounded-xl bg-[#145044] py-3.5 text-xs font-bold uppercase tracking-[.1em] text-white shadow-sm transition hover:bg-[#0e3d34] disabled:opacity-40">{submitting?'Submitting…':'Place order · '+money(total)}</button>
        <p className="mt-2 text-center text-[10px] leading-4 text-[#78837d]">No online payment is taken. Pay by Cash or Mada {orderType==='Home Delivery'?'on delivery.':'at the restaurant.'}</p>
      </aside>
    </div>}

    <footer className="mx-auto max-w-6xl px-4 pb-8 pt-3 text-center text-[10px] text-[#8b9086]">Powered by Musafir Fast Food · Prices in SAR · VAT 15%</footer>
  </main>;
}
