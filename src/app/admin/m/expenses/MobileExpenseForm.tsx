import ConnectedExpenseForm, { type ExpenseFormProps } from "@/components/ConnectedExpenseForm";
export default function MobileExpenseForm(props:ExpenseFormProps){return <ConnectedExpenseForm {...props} basePath="/admin/m/expenses"/>;}
