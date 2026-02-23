import { User } from './entities/user.entity';
import { FixedCost } from './entities/fixed-cost.entity';
import { Role } from './enums/role.enum';
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
    console.log(adminData);
    console.log(existingUser);
    console.log(fixedCostsData);
    console.log('Seeding completed successfully');
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
