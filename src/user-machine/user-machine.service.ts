import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserMachine } from 'src/entities/user-machine.entity';

@Injectable()
export class UserMachineService {
  constructor(
    @InjectRepository(UserMachine)
    private readonly userMachineRepository: Repository<UserMachine>,
  ) {}

  async assignMachineToUser(userId: string, machineIds: string[]) {
    if (!Array.isArray(machineIds)) {
      throw new BadRequestException('machineId must be an array');
    }
    if (machineIds.length === 0) {
      throw new BadRequestException('No machines provided for assignment');
    }

    // Check for existing assignments
    const existingAssignments = await this.userMachineRepository.find({
      where: machineIds.map(machineId => ({ userId, machineId })),
    });
    const existingMachineIds = new Set(existingAssignments.map(a => a.machineId));
    const newMachineIds = machineIds.filter(id => id && !existingMachineIds.has(id));

    if (newMachineIds.length === 0) {
      throw new BadRequestException('All provided machines are already assigned to this user.');
    }

    const newAssignments = newMachineIds.map(machineId =>
      this.userMachineRepository.create({ userId, machineId })
    );
    try {
      await this.userMachineRepository.save(newAssignments);
      return {
        success: true,
        message: 'Machines assigned successfully.',
        duplicates: existingMachineIds.size > 0 ? Array.from(existingMachineIds) : [],
      };
    } catch (error) {
      throw new Error('Error assigning machines to user');
    }
  }

  async getUserMachines(skip: number, take: number) {
    const [userMachines, total] = await this.userMachineRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      relations: ['user', 'machine'],
    });
    return {
      userMachines,
      total,
    };
  }

  async getUserMachineById(id: string) {
    const userMachine = await this.userMachineRepository.findOne({
      where: { id },
      relations: ['user', 'machine'],
    });
    if (!userMachine) throw new NotFoundException('UserMachine not found');
    return userMachine;
  }

  async updateUserMachine(id: string, machineIds: string[]) {
    const updates = machineIds.map(machineId =>
      this.userMachineRepository.update(id, { machineId })
    );
    return Promise.all(updates);
  }

  async deleteUserMachine(id: string) {
    const userMachine = await this.userMachineRepository.findOne({ where: { id } });
    if (!userMachine) throw new NotFoundException('UserMachine not found');
    await this.userMachineRepository.remove(userMachine);
    return { message: `UserMachine with ID ${id} removed successfully` };
  }
}
