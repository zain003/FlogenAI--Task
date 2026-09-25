import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserEntity } from './interfaces/user.interface';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registers a new user (Customer or Provider)
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: normalizedEmail }).exec();
    if (existingUser) {
      throw new ConflictException(
        'A user with this email address already exists',
      );
    }

    // Hash the password with bcrypt (minimum 10 rounds per spec)
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      const createdUser = new this.userModel({
        email: normalizedEmail,
        passwordHash,
        name: registerDto.name.trim(),
        role: registerDto.role,
      });

      const savedUser = await createdUser.save();
      const userId = savedUser._id.toString();

      const payload: JwtPayload = {
        sub: userId,
        email: savedUser.email,
        role: savedUser.role,
      };

      const accessToken = this.jwtService.sign(payload);

      this.logger.log(
        `Successfully registered user ${userId} with role ${savedUser.role}`,
      );

      return {
        accessToken,
        user: {
          id: userId,
          email: savedUser.email,
          name: savedUser.name,
          role: savedUser.role,
        },
      };
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(
          'A user with this email address already exists',
        );
      }
      throw error;
    }
  }

  /**
   * Authenticates a user by email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    const user = await this.userModel.findOne({ email: normalizedEmail }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const userId = user._id.toString();
    const payload: JwtPayload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User ${userId} authenticated successfully`);

    return {
      accessToken,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Retrieves profile details for the authenticated user
   */
  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: user.updatedAt ? user.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
