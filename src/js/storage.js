export const STORAGE_KEY='cashpilot_hybrid_v1';
export const BACKUP_KEY='cashpilot_pre_import_backup_v1';
export const SCHEMA_VERSION=3;
export const budgetCategories=['طعام','مواصلات','دراسة','صحة','فواتير','إنترنت','تسوق','ترفيه','أخرى'];
export function createEmptyData(){return{schemaVersion:SCHEMA_VERSION,initialized:false,settings:{theme:'light',currency:'EGP'},transactions:[],budgets:Object.fromEntries(budgetCategories.map(c=>[c,0])),debts:[],investments:[]}}
export function normalizeData(input){const base=createEmptyData();if(!input||typeof input!=='object')return base;return{schemaVersion:SCHEMA_VERSION,initialized:Boolean(input.initialized),settings:{...base.settings,...(input.settings||{})},transactions:Array.isArray(input.transactions)?input.transactions:[],budgets:{...base.budgets,...(input.budgets||{})},debts:Array.isArray(input.debts)?input.debts:[],investments:Array.isArray(input.investments)?input.investments:[]}}
export function loadData(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?normalizeData(JSON.parse(raw)):createEmptyData()}catch{return createEmptyData()}}
export function saveData(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
export function validateImport(payload){
  if(!payload||typeof payload!=='object')return'ملف غير صالح.';
  const allowed=['schemaVersion','initialized','settings','transactions','budgets','debts','investments'];
  const unknown=Object.keys(payload).filter(k=>!allowed.includes(k));
  if(unknown.length)return'الملف يحتوي مفاتيح غير معروفة: '+unknown.join(', ');
  if(Number(payload.schemaVersion)!==SCHEMA_VERSION)return'نسخة البيانات غير مدعومة في هذه النسخة.';
  if(!Array.isArray(payload.transactions))return'قائمة المعاملات غير صحيحة.';
  if(!Array.isArray(payload.debts))return'قائمة الديون غير صحيحة.';
  if(!Array.isArray(payload.investments))return'قائمة الاستثمارات غير صحيحة.';

  const txError=validateTransactionRecords(payload.transactions);
  if(txError)return txError;

  const debtError=validateDebtRecords(payload.debts);
  if(debtError)return debtError;

  const investmentError=validateInvestmentRecords(payload.investments);
  if(investmentError)return investmentError;

  const budgetError=validateBudgetObject(payload.budgets||{});
  if(budgetError)return budgetError;

  return null;
}
function isValidDateString(value){
  if(!value)return true;
  const date=new Date(value);
  return !Number.isNaN(date.getTime());
}
function isNonNegativeNumber(value){
  return Number.isFinite(Number(value))&&Number(value)>=0;
}
function validateTransactionRecords(records){
  const allowedCategories={
    income:['راتب','عمل حر','مشاريع','استثمار','أخرى'],
    expense:['طعام','مواصلات','دراسة','صحة','فواتير','إنترنت','تسوق','ترفيه','أخرى']
  };
  for(const [index,item] of records.entries()){
    if(!item||typeof item!=='object')return `المعاملة رقم ${index+1} غير صحيحة.`;
    if(!['income','expense'].includes(item.type))return `نوع المعاملة رقم ${index+1} غير صحيح.`;
    if(!item.name||typeof item.name!=='string')return `اسم المعاملة رقم ${index+1} غير صحيح.`;
    if(!isNonNegativeNumber(item.amount)||Number(item.amount)===0)return `مبلغ المعاملة رقم ${index+1} غير صحيح.`;
    if(!isValidDateString(item.date))return `تاريخ المعاملة رقم ${index+1} غير صحيح.`;
    if(!(allowedCategories[item.type]||[]).includes(item.category))return `فئة المعاملة رقم ${index+1} غير مدعومة.`;
  }
  return null;
}
function validateDebtRecords(records){
  for(const [index,item] of records.entries()){
    if(!item||typeof item!=='object')return `الدين رقم ${index+1} غير صحيح.`;
    if(!item.name||typeof item.name!=='string')return `اسم الدين رقم ${index+1} غير صحيح.`;
    if(!isNonNegativeNumber(item.amount)||Number(item.amount)===0)return `مبلغ الدين رقم ${index+1} غير صحيح.`;
    if(!isNonNegativeNumber(item.paid||0))return `المدفوع في الدين رقم ${index+1} غير صحيح.`;
    if(!isValidDateString(item.dueDate))return `تاريخ استحقاق الدين رقم ${index+1} غير صحيح.`;
  }
  return null;
}
function validateInvestmentRecords(records){
  for(const [index,item] of records.entries()){
    if(!item||typeof item!=='object')return `الاستثمار رقم ${index+1} غير صحيح.`;
    if(!item.name||typeof item.name!=='string')return `اسم الاستثمار رقم ${index+1} غير صحيح.`;
    if(!isNonNegativeNumber(item.capital)||Number(item.capital)===0)return `رأس مال الاستثمار رقم ${index+1} غير صحيح.`;
    if(!Number.isFinite(Number(item.profit||0)))return `ربح الاستثمار رقم ${index+1} غير صحيح.`;
    if(!isValidDateString(item.startDate))return `تاريخ بداية الاستثمار رقم ${index+1} غير صحيح.`;
  }
  return null;
}
function validateBudgetObject(budgets){
  if(!budgets||typeof budgets!=='object'||Array.isArray(budgets))return'بيانات الميزانية غير صحيحة.';
  for(const [category,value] of Object.entries(budgets)){
    if(!budgetCategories.includes(category))return `فئة الميزانية غير مدعومة: ${category}`;
    if(!isNonNegativeNumber(value))return `قيمة ميزانية ${category} غير صحيحة.`;
  }
  return null;
}
export function backupBeforeImport(data){localStorage.setItem(BACKUP_KEY,JSON.stringify(data))}
export function clearData(){localStorage.removeItem(STORAGE_KEY)}
