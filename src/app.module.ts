import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';

// Guards
import { AtGuard } from './common';

// Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FileModule } from './file/file.module';
import { MachinesModule } from './machines/machines.module';
import { ServicesModule } from './services/services.module';
import { ItemsModule } from './items/items.module';
import { UnitCategoryModule } from './unit-category/unit-category.module';
import { UomModule } from './uom/uom.module';
import { VendorsModule } from './vendors/vendors.module';
import { PurchasesModule } from './purchases/purchases.module';
import { PurchaseItemsModule } from './purchase-items/purchase-items.module';
import { PurchaseItemNotesModule } from './purchase-item-notes/purchase-item-notes.module';
import { SalesModule } from './sales/sales.module';
import { SaleItemsModule } from './sale-items/sale-items.module';
import { SaleItemNotesModule } from './sale-item-notes/sale-item-notes.module';
import { BincardModule } from './bincard/bincard.module';
import { OperatorStockModule } from './operator-stock/operator-stock.module';
import { OrdersModule } from './orders/orders.module';
import { OrderItemsModule } from './order-items/order-items.module';
import { CustomersModule } from './customers/customers.module';
import { SalesPartnersModule } from './sales-partners/sales-partners.module';
import { PaymentTermsModule } from './payment-terms/payment-terms.module';
import { PaymentTransactionsModule } from './payment-transactions/payment-transactions.module';
import { CommissionsModule } from './commissions/commissions.module';
import { CommissionTransactionsModule } from './commission-transactions/commission-transactions.module';
import { PricingModule } from './pricing/pricing.module';
import { OrderItemNotesModule } from './order-item-notes/order-item-notes.module';
import { DiscountsModule } from './discounts/discounts.module';
import { ContactModule } from './contact/contact.module';
import { AccountModule } from './account/account.module';

// Services & Controllers
import { UserMachineService } from './user-machine/user-machine.service';
import { UsersService } from './users/users.service';
import { MachinesService } from './machines/machines.service';
import { FileController } from './file/file.controller';
import { UserMachineController } from './user-machine/user-machine.controller';
import { UsersController } from './users/users.controller';
import { MachinesController } from './machines/machines.controller';

// Config
import { createDatabaseConfig } from './config/database.config';
import { FixedCostModule } from './fixed-cost/fixed-cost.module';
import { FilePathModule } from './file-path/file-path.module';
import { NonStockServicesModule } from './non-stock-services/non-stock-services.module';
import configuration from './config/configuration';


@Module({
  imports: [
    // Configuration (loaded first)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database (loaded second)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(Object.values(entities)),

    // Feature Modules (alphabetical order)
    AccountModule,
    AuthModule,
    ContactModule,
    CustomersModule,
    CommissionsModule,
    CommissionTransactionsModule,
    DiscountsModule,
    FileModule,
    ItemsModule,
    MachinesModule,
    BincardModule,
    OperatorStockModule,
    OrdersModule,
    OrderItemsModule,
    OrderItemNotesModule,
    PricingModule,
    PurchaseItemsModule,
    PurchaseItemNotesModule,
    PurchasesModule,
    SalesModule,
    SaleItemsModule,
    SaleItemNotesModule,
    SalesPartnersModule,
    ServicesModule,
    UnitCategoryModule,
    UomModule,
    UsersModule,
    VendorsModule,
    PaymentTermsModule,
    PaymentTransactionsModule,
    FixedCostModule,
    FilePathModule,
    NonStockServicesModule,
  ],
  providers: [
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    },
    
    // Shared Services
    UserMachineService,
    UsersService,
    MachinesService,
  ],
  controllers: [
    FileController,
    UserMachineController,
    UsersController,
    MachinesController,
  ],
})
export class AppModule {}