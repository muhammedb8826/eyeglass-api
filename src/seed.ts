import { User } from './entities/user.entity';
import { FixedCost } from './entities/fixed-cost.entity';
import { Role } from './enums/role.enum';
import { UnitCategory } from './entities/unit-category.entity';
import { UOM } from './entities/uom.entity';
import { Item } from './entities/item.entity';
import { Machine } from './entities/machine.entity';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { getDataSourceOptions } from './config/database.config';

const AppDataSource = new DataSource(
  getDataSourceOptions({
    entities: ['src/entities/*.entity.ts'],
    logging: false,
  }),
);

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');

    const userRepository = AppDataSource.getRepository(User);
    const fixedCostRepository = AppDataSource.getRepository(FixedCost);
    const unitCategoryRepository = AppDataSource.getRepository(UnitCategory);
    const uomRepository = AppDataSource.getRepository(UOM);
    const itemRepository = AppDataSource.getRepository(Item);
    const machineRepository = AppDataSource.getRepository(Machine);

    // Seed Admin User
    const adminData = {
      first_name: "EYEGLASS",
      middle_name: "EYEGLASS",
      last_name: "ADMIN",
      gender: "male",
      phone: "+251905078826",
      email: 'admin@eyeglass.com',
      password: await bcrypt.hash('password', 10),
      confirm_password: await bcrypt.hash('password', 10),
      address: "123 Main Street",
      profile: "",
      roles: Role.ADMIN,
      is_active: true,
    };

    const existingUser = await userRepository.findOne({ 
      where: { email: adminData.email } 
    });

    if (!existingUser) {
      await userRepository.save(adminData);
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }

    // Seed Fixed Costs
    const fixedCostsData = [
      {
        monthlyFixedCost: 50000,
        dailyFixedCost: 1667,
        description: "Rent for office space"
      },
      {
        monthlyFixedCost: 15000,
        dailyFixedCost: 500,
        description: "Utilities (electricity, water, internet)"
      },
      {
        monthlyFixedCost: 25000,
        dailyFixedCost: 833,
        description: "Employee salaries"
      },
      {
        monthlyFixedCost: 10000,
        dailyFixedCost: 333,
        description: "Insurance and licenses"
      },
      {
        monthlyFixedCost: 8000,
        dailyFixedCost: 267,
        description: "Maintenance and repairs"
      },
      {
        monthlyFixedCost: 12000,
        dailyFixedCost: 400,
        description: "Marketing and advertising"
      },
      {
        monthlyFixedCost: 6000,
        dailyFixedCost: 200,
        description: "Office supplies and equipment"
      },
      {
        monthlyFixedCost: 3000,
        dailyFixedCost: 100,
        description: "Software subscriptions"
      }
    ];

    for (const fixedCostData of fixedCostsData) {
      const existingFixedCost = await fixedCostRepository.findOne({
        where: { description: fixedCostData.description }
      });

      if (!existingFixedCost) {
        await fixedCostRepository.save(fixedCostData);
        console.log(`Fixed cost "${fixedCostData.description}" created successfully`);
      } else {
        console.log(`Fixed cost "${fixedCostData.description}" already exists`);
      }
    }

    // Seed basic machine
    let defaultMachine = await machineRepository.findOne({
      where: { name: 'Default Machine' },
    });
    if (!defaultMachine) {
      defaultMachine = await machineRepository.save({
        name: 'Default Machine',
        status: true,
        description: 'Default production machine for lens items',
      });
      console.log('Default machine created');
    } else {
      console.log('Default machine already exists');
    }

    // Seed unit category for countable pieces
    let pieceCategory = await unitCategoryRepository.findOne({
      where: { name: 'Piece' },
    });
    if (!pieceCategory) {
      pieceCategory = await unitCategoryRepository.save({
        name: 'Piece',
        description: 'Countable items (pcs)',
        constant: false,
        constantValue: 1,
      });
      console.log('Unit category "Piece" created');
    } else {
      console.log('Unit category "Piece" already exists');
    }

    // Seed UOM "pcs"
    let pcsUom = await uomRepository.findOne({
      where: {
        name: 'Piece',
        abbreviation: 'pcs',
        unitCategoryId: pieceCategory.id,
      },
    });
    if (!pcsUom) {
      pcsUom = await uomRepository.save({
        name: 'Piece',
        abbreviation: 'pcs',
        conversionRate: 1,
        baseUnit: true,
        unitCategoryId: pieceCategory.id,
      });
      console.log('UOM "Piece (pcs)" created');
    } else {
      console.log('UOM "Piece (pcs)" already exists');
    }

    // Seed basic lens items with itemCode
    const lensItemsData = [
      {
        itemCode: '1113',
        name: 'SV Glass white',
        lensType: 'SINGLE_VISION',
        lensMaterial: 'GLASS',
        lensIndex: 1.5,
      },
      {
        itemCode: '1123',
        name: 'SV Glass photosolar',
        lensType: 'SINGLE_VISION',
        lensMaterial: 'GLASS_PHOTOSOLAR',
        lensIndex: 1.5,
      },
      {
        itemCode: '3425',
        name: 'Polarized Progressive',
        lensType: 'PROGRESSIVE',
        lensMaterial: 'POLARIZED',
        lensIndex: 1.6,
      },
      {
        itemCode: '4000',
        name: 'Finished Lens',
        lensType: 'FINISHED',
        lensMaterial: 'PLASTIC',
        lensIndex: 1.5,
      },
    ];

    for (const lensItem of lensItemsData) {
      const existingItem = await itemRepository.findOne({
        where: [
          { itemCode: lensItem.itemCode },
          { name: lensItem.name },
        ],
      });

      if (!existingItem) {
        await itemRepository.save({
          itemCode: lensItem.itemCode,
          name: lensItem.name,
          description: lensItem.lensType,
          reorder_level: 50,
          initial_stock: 0,
          updated_initial_stock: 0,
          machineId: defaultMachine.id,
          can_be_purchased: true,
          can_be_sold: true,
          quantity: 0,
          unitCategoryId: pieceCategory.id,
          defaultUomId: pcsUom.id,
          purchaseUomId: pcsUom.id,
          lensMaterial: lensItem.lensMaterial,
          lensIndex: lensItem.lensIndex,
          lensType: lensItem.lensType,
        } as Item);
        console.log(`Lens item "${lensItem.itemCode} - ${lensItem.name}" created`);
      } else {
        console.log(`Lens item "${lensItem.itemCode} - ${lensItem.name}" already exists`);
      }
    }

    console.log('Seeding completed successfully');
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
