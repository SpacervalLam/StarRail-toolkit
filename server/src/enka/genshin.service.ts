import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import axios from 'axios';
import { GenshinData } from './entities/genshin-data.entity';
import { EnkaData } from './entities/type/genshin';
import { fetchGenshinData } from './services/fetch';

@Injectable()
export class GenshinService {
  constructor(
    @InjectRepository(GenshinData)
    private readonly dataRepo: Repository<GenshinData>,
  ) { }

  public async fetchAndStoreData(uid: string): Promise<GenshinData | null> {
    let enkaData: EnkaData | null;
    try {
      enkaData = await fetchGenshinData(uid);
      if (!enkaData) {
        throw new InternalServerErrorException('UID不存在或未公开信息');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status) {
        throw error; // Propagate the error with status code
      }
      throw new InternalServerErrorException('获取数据失败');
    }

    try {
      await this.dataRepo.upsert(
        {
          uid,
          playerInfo: enkaData.playerInfo,
          avatarInfoList: enkaData.avatarInfoList,
          ttl: enkaData.ttl,
        },
        ['uid'],
      );
      return this.dataRepo.findOne({ where: { uid } }) as Promise<GenshinData>;
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new InternalServerErrorException('数据库操作异常');
      }
      throw err;
    }
  }

  public async getDataFromDb(uid: string): Promise<GenshinData | null> {
    return this.dataRepo.findOne({ where: { uid } });
  }

  public async getAllUids(): Promise<string[]> {
    const records = await this.dataRepo.find({ select: ['uid'] });
    console.log("从数据库中找到了以下uid：" + records.map(r => r.uid));
    return records.map(r => r.uid).filter((u): u is string => !!u);
  }
}
