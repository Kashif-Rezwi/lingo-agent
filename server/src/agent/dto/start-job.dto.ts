import { IsString, IsArray, ArrayMinSize, IsUrl, IsNotEmpty } from 'class-validator';

/** Request body for POST /agent/run — starts a new agent pipeline job. */
export class StartJobDto {
    @IsUrl()
    repoUrl: string;

    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    locales: string[];

    @IsString()
    @IsNotEmpty()
    githubToken: string;
}
