import { AssignMachineDto } from './dto/AssignMachineDto.dto';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UserMachineService } from './user-machine.service';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('user-machine')
@RequirePermissions(Permissions.MASTER_READ)
export class UserMachineController {
    constructor(private readonly userMachineService: UserMachineService) {}
    @Post()
    @RequirePermissions(Permissions.MASTER_WRITE)
    async assignMachineToUser(@Body() assignMachineDto: AssignMachineDto) {
        return this.userMachineService.assignMachineToUser(assignMachineDto.userId, assignMachineDto.machineId);
      }

      @Get()
      findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
        const skip = (page - 1) * limit
        const take = limit
        return this.userMachineService.getUserMachines(skip, take);
      }

      @Get(':id')
      findOne(@Param('id') id: string) {
        return this.userMachineService.getUserMachineById(id);
      }

      @Put(':id')
      @RequirePermissions(Permissions.MASTER_WRITE)
      update(@Param('id') id: string, @Body() updateMachineDto: { machineId: string[] }) {
        return this.userMachineService.updateUserMachine(id, updateMachineDto.machineId);
      }

      @Delete(':id')
      @RequirePermissions(Permissions.MASTER_WRITE)
      remove(@Param('id') id: string) {
        return this.userMachineService.deleteUserMachine(id);
      }
}
