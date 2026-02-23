import { CreateCommissionDto } from "src/commissions/dto/create-commission.dto";
import { CreateCustomerDto } from "src/customers/dto/create-customer.dto";
import { CreateOrderItemDto } from "src/order-items/dto/create-order-item.dto";
import { CreatePaymentTermDto } from "src/payment-terms/dto/create-payment-term.dto";
import { CreateSalesPartnerDto } from "src/sales-partners/dto/create-sales-partner.dto";

export class CreateOrderDto {
  series: string;
  customerId: string;
  status: string;
  orderDate: Date;
  orderSource: string;
  deliveryDate: Date;
  totalAmount: number;
  tax: number;
  grandTotal: number;
  totalQuantity: number;
  internalNote?: string;
  fileNames: string[];
  adminApproval: boolean;


  // Nested DTOs
  customer: CreateCustomerDto;
  orderItems: CreateOrderItemDto[];
  paymentTerm?: CreatePaymentTermDto;
  commission?: CreateCommissionDto;
  salesPartner?: CreateSalesPartnerDto;
}
