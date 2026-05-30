import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from "../../shared/header/header";
import { ModalsHost } from '../../modals/modals-host/modals-host';


@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header,ModalsHost],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {}
